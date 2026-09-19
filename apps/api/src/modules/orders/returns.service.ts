import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { parsePaging } from '../../common/pagination';

// REQUESTED -> APPROVED -> RESTOCKED -> DEBT_ADJUSTED (RESTOCKED+DEBT_ADJUSTED chung 1 tx)
@Injectable()
export class ReturnsService {
  constructor(private prisma: PrismaService) {}

  create(
    orderId: string,
    items: { orderItemId?: string; variantId?: string; qty: number; condition?: string; reason?: string; warehouse?: string; location?: string }[],
    note: string | undefined,
    inspectedAt: string | undefined,
    actorId: string,
  ) {
    if (!items?.length) throw new BadRequestException('Phiếu trả phải có ít nhất một sản phẩm');
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, returns: { include: { items: true } } } });
      if (!order) throw new NotFoundException('Không thấy đơn');
      if (!['XUAT_KHO', 'VAN_CHUYEN', 'HOA_DON', 'HOAN_TAT'].includes(order.status)) {
        throw new BadRequestException('Chỉ trả hàng của đơn đã xuất kho');
      }
      const createItems = items.map((input) => {
        const qty = Number(input.qty);
        if (!Number.isInteger(qty) || qty <= 0) throw new BadRequestException('Số lượng trả phải là số nguyên > 0');
        const source = input.orderItemId
          ? order.items.find((item) => item.id === input.orderItemId)
          : order.items.find((item) => item.variantId && item.variantId === input.variantId);
        if (!source) throw new BadRequestException('Sản phẩm trả không thuộc đơn hàng');
        const returned = order.returns
          .filter((r) => r.status !== 'REJECTED')
          .flatMap((r) => r.items)
          .filter((item) => item.orderItemId === source.id || (!item.orderItemId && source.variantId && item.variantId === source.variantId))
          .reduce((sum, item) => sum + item.qty, 0);
        if (returned + qty > source.exportedQty) throw new BadRequestException(`Số lượng trả vượt số đã xuất của dòng ${source.id}`);
        return {
          orderItemId: source.id, variantId: source.variantId, productName: source.productName,
          color: source.color, size: source.size, qty, unitPrice: source.unitPrice,
          condition: input.condition || 'HANG_TOT', reason: input.reason || null,
          warehouse: input.warehouse || source.warehouse, location: input.location || null,
        };
      });
      const result = await tx.return.create({
        data: {
          orderId, customerId: order.customerId, note,
          inspectedAt: inspectedAt ? new Date(inspectedAt) : new Date(), items: { create: createItems },
        },
        include: { items: true },
      });
      await tx.auditLog.create({ data: { actorId, action: 'RETURN_CREATE', entityType: 'Return', entityId: result.id, payload: { orderId } as any } });
      return result;
    });
  }

  async approve(id: string, actorId: string) {
    const current = await this.prisma.return.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không thấy phiếu trả');
    if (current.status !== 'REQUESTED') throw new BadRequestException('Chỉ duyệt phiếu đang chờ');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.return.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: 'RETURN_APPROVE', entityType: 'Return', entityId: id } });
      return result;
    });
  }

  async reject(id: string, note: string | undefined, actorId: string) {
    const current = await this.prisma.return.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không thấy phiếu trả');
    if (current.status !== 'REQUESTED') throw new BadRequestException('Chỉ từ chối phiếu đang chờ');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.return.update({ where: { id }, data: { status: 'REJECTED', note: note || current.note } });
      await tx.auditLog.create({ data: { actorId, action: 'RETURN_REJECT', entityType: 'Return', entityId: id, payload: { note } as any } });
      return result;
    });
  }

  // Nhập lại tồn + trừ ngược công nợ trong 1 transaction
  restockAndAdjustDebt(id: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.return.findUnique({ where: { id }, include: { items: true, order: { include: { invoice: true } } } });
      if (!r || r.status !== 'APPROVED') throw new BadRequestException('Chỉ restock từ APPROVED');
      let totalQty = 0;
      let credit = 0;
      for (const it of r.items) {
        await tx.returnItem.update({ where: { id: it.id }, data: { restockedQty: it.qty } });
        totalQty += it.qty;
        credit += it.qty * Number(it.unitPrice);
        if (!it.variantId || it.condition !== 'HANG_TOT') continue;
        let stock = await tx.inventoryStock.findFirst({ where: { variantId: it.variantId, warehouse: it.warehouse, location: it.location } });
        if (stock) {
          await tx.$queryRawUnsafe(`SELECT id FROM "InventoryStock" WHERE id=$1 FOR UPDATE`, stock.id);
          stock = (await tx.inventoryStock.findUnique({ where: { id: stock.id } }))!;
          await tx.inventoryStock.update({ where: { id: stock.id }, data: { onHand: stock.onHand + it.qty } });
        } else {
          await tx.inventoryStock.create({ data: { variantId: it.variantId, warehouse: it.warehouse, location: it.location, onHand: it.qty } });
        }
        await tx.inventoryTransaction.create({ data: { variantId: it.variantId, type: 'IN', qty: it.qty, refCode: `RETURN-${id}`, actorId, note: it.reason } });
      }
      await tx.return.update({ where: { id }, data: { status: 'RESTOCKED' } });
      const orderTotal = Math.max(0, Number(r.order!.total) - credit);
      const orderPaid = Math.min(Number(r.order!.paid), orderTotal);
      await tx.order.update({ where: { id: r.orderId! }, data: { total: orderTotal, paid: orderPaid } });
      if (r.order!.invoice && !r.order!.invoice.deletedAt) {
        const status = orderPaid <= 0 ? 'UNPAID' : orderPaid < orderTotal ? 'PARTIAL' : 'PAID';
        await tx.invoice.update({ where: { id: r.order!.invoice.id }, data: { total: orderTotal, paid: orderPaid, status } });
      }
      await tx.return.update({ where: { id }, data: { status: 'DEBT_ADJUSTED' } });
      await tx.auditLog.create({ data: { actorId, action: 'RETURN_DEBT_ADJUST', entityType: 'Return', entityId: id, payload: { totalQty, credit } as any } });
      return { ok: true, totalQty, credit };
    });
  }

  // Kho ảnh: sort ở SQL theo createdAt, phân trang, 2 chiều (fix lỗi gom object JS)
  images(orderId: string, sort: 'newest' | 'oldest', page: number, pageSize: number) {
    const paging = parsePaging({ page, pageSize });
    const orderBy = sort === 'oldest' ? { createdAt: 'asc' as const } : { createdAt: 'desc' as const };
    return this.prisma.$transaction([
      this.prisma.orderImage.count({ where: { orderId } }),
      this.prisma.orderImage.findMany({ where: { orderId }, orderBy, skip: paging.skip, take: paging.pageSize }),
    ]).then(([total, data]) => ({ data, total, page: paging.page, pageSize: paging.pageSize, sort }));
  }

  addImage(orderId: string, url: string, thumbnailUrl: string | undefined, uploadedBy: string) {
    const normalizedUrl = url?.trim();
    if (!normalizedUrl) throw new BadRequestException('Thiếu URL ảnh');
    return this.prisma.orderImage.create({
      data: { orderId, url: normalizedUrl, thumbnailUrl: thumbnailUrl?.trim() || null, uploadedBy },
    });
  }
}
