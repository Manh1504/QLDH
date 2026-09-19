import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { parsePaging } from '../../common/pagination';
import { CreateOrderDto } from './order.dto';
import { canTransition } from './state-machine';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  private genCode(): string {
    const d = new Date();
    const p = (n: number, l = 2) => String(n).padStart(l, '0');
    return `HD${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${Math.floor(Math.random() * 90 + 10)}`;
  }

  async create(dto: CreateOrderDto, actorId: string) {
    if (!dto.items?.length) throw new BadRequestException('Đơn phải có ít nhất 1 dòng hàng');
    if (dto.items.some((i: any) => !Number.isFinite(Number(i.qty)) || i.qty <= 0 || !Number.isFinite(Number(i.unitPrice)) || i.unitPrice < 0)) {
      throw new BadRequestException('Số lượng phải > 0 và đơn giá không được âm');
    }
    const total = dto.items.reduce((s: number, i: any) => s + i.qty * i.unitPrice, 0);
    // Mã đơn do server đảm bảo duy nhất: thử mã client gửi, trùng thì tự sinh lại (tối đa 5 lần)
    let code = dto.code?.trim() || this.genCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const order = await this.prisma.order.create({
          data: {
            code, customerId: dto.customerId, type: dto.type || 'BAN_LE',
            urgent: Boolean(dto.urgent), shipDate: dto.shipDate ? new Date(dto.shipDate) : null,
            createdAt: dto.orderDate ? new Date(dto.orderDate) : undefined,
            customerNote: dto.customerNote || null, staffNote: dto.staffNote || null,
            note: dto.note || [dto.customerNote, dto.staffNote].filter(Boolean).join(' | ') || null,
            total, status: 'MOI',
            items: {
              create: dto.items.map((i: any) => ({
                variantId: i.variantId || null,
                productName: i.variantId ? null : i.productName || null,
                color: i.variantId ? null : i.color || null,
                size: i.variantId ? null : i.size || null,
                warehouse: (i as any).warehouse || 'KHO_CHINH',
                qty: i.qty, unitPrice: i.unitPrice, saleType: i.saleType || null,
                imageUrl: i.imageUrl || null, note: i.note,
              })),
            },
            history: { create: { toStatus: 'MOI', actorId, note: 'Tạo đơn' } },
          },
          include: { items: true },
        });
        return order;
      } catch (e: any) {
        if (e.code === 'P2002' && attempt < 4) { code = this.genCode(); continue; }
        throw e;
      }
    }
    throw new ConflictException('Không sinh được mã đơn, thử lại');
  }

  list(q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.customerId) where.customerId = q.customerId;
    if (q.q) where.code = { contains: q.q, mode: 'insensitive' };
    return this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { customer: true } }),
    ]).then(([total, data]: [number, any[]]) => ({ data, total, page, pageSize }));
  }

  async get(id: string) {
    const o = await this.prisma.order.findUnique({ where: { id }, include: { items: { include: { variant: { include: { product: true } } } }, history: { orderBy: { createdAt: 'asc' } }, customer: true, shipment: true, invoice: true } });
    if (!o) throw new NotFoundException('Không thấy đơn');
    return o;
  }

  // Khóa soạn: 1 đơn 1 người, trả 409 + tên người đang giữ
  async lock(id: string, actorId: string) {
    const o = await this.prisma.order.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Không thấy đơn');
    if (!['MOI', 'DANG_SOAN'].includes(o.status)) throw new BadRequestException('Đơn đã khóa chi tiết sau khi xuất kho');
    if (o.lockedById && o.lockedById !== actorId) {
      throw new ConflictException(`Đơn đang do ${o.lockedById} soạn`);
    }
    return this.prisma.order.update({ where: { id }, data: { lockedById: actorId, lockedAt: new Date() } });
  }

  async unlock(id: string, actorId: string) {
    const o = await this.prisma.order.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Không thấy đơn');
    if (o.lockedById && o.lockedById !== actorId) throw new ConflictException('Không phải người đang giữ');
    return this.prisma.order.update({ where: { id }, data: { lockedById: null, lockedAt: null } });
  }

  // Giữ tồn khi DANG_SOAN: held += qty trong transaction, kiểm tra khả dụng
  async hold(id: string, actorId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const o = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!o) throw new NotFoundException('Không thấy đơn');
      if (o.status !== 'MOI') throw new BadRequestException('Chỉ giữ tồn từ trạng thái Mới');
      if (o.lockedById && o.lockedById !== actorId) throw new ConflictException(`Đơn đang do ${o.lockedById} soạn`);
      for (const it of o.items) {
        if (!it.variantId) { // dòng nhập tay: không giữ tồn, chỉ đánh dấu
          await tx.orderItem.update({ where: { id: it.id }, data: { heldQty: it.qty } });
          continue;
        }
        let stock = await tx.inventoryStock.findFirst({ where: { variantId: it.variantId!, warehouse: (it as any).warehouse || 'KHO_CHINH' } });
        if (!stock) throw new BadRequestException(`Chưa có tồn cho biến thể ${it.variantId}`);
        await tx.$queryRawUnsafe(`SELECT id FROM "InventoryStock" WHERE id=$1 FOR UPDATE`, stock.id);
        stock = (await tx.inventoryStock.findUnique({ where: { id: stock.id } }))!;
        if (stock.onHand - stock.held < it.qty) throw new ConflictException(`Không đủ tồn cho ${it.variantId}`);
        await tx.inventoryStock.update({ where: { id: stock.id }, data: { held: stock.held + it.qty, version: { increment: 1 } } });
        await tx.orderItem.update({ where: { id: it.id }, data: { heldQty: it.qty } });
        await tx.inventoryTransaction.create({ data: { variantId: it.variantId, type: 'HOLD', qty: it.qty, refCode: o.code, actorId } });
      }
      return tx.order.update({ where: { id }, data: { status: 'DANG_SOAN', lockedById: actorId, lockedAt: new Date(), history: { create: { fromStatus: 'MOI', toStatus: 'DANG_SOAN', actorId } } } });
    });
  }

  async release(id: string, actorId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const o = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!o) throw new NotFoundException('Không thấy đơn');
      if (o.status !== 'DANG_SOAN') throw new BadRequestException('Chỉ nhả giữ khi đơn đang soạn');
      if (o.lockedById && o.lockedById !== actorId) throw new ConflictException(`Đơn đang do ${o.lockedById} soạn`);
      for (const it of o.items) {
        if (!it.heldQty) continue;
        await tx.orderItem.update({ where: { id: it.id }, data: { heldQty: 0 } });
        if (!it.variantId) continue; // dòng tay: không có tồn để nhả
        let stock = await tx.inventoryStock.findFirst({ where: { variantId: it.variantId!, warehouse: (it as any).warehouse || 'KHO_CHINH' } });
        if (stock) {
          await tx.$queryRawUnsafe(`SELECT id FROM "InventoryStock" WHERE id=$1 FOR UPDATE`, stock.id);
          stock = (await tx.inventoryStock.findUnique({ where: { id: stock.id } }))!;
          await tx.inventoryStock.update({ where: { id: stock.id }, data: { held: Math.max(0, stock.held - it.heldQty) } });
        }
        await tx.inventoryTransaction.create({ data: { variantId: it.variantId, type: 'RELEASE', qty: it.heldQty, refCode: o.code, actorId } });
      }
      return tx.order.update({ where: { id }, data: { status: 'MOI', lockedById: null, lockedAt: null, history: { create: { fromStatus: o.status, toStatus: 'MOI', actorId, note: 'Nhả giữ' } } } });
    });
  }

  // Xuất kho: trừ tồn thật + tạo thẻ kho + khóa sửa (optimistic version)
  async export(id: string, actorId: string, version: number) {
    return this.prisma.$transaction(async (tx: any) => {
      const o = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!o) throw new NotFoundException('Không thấy đơn');
      if (o.status !== 'DANG_SOAN') throw new BadRequestException('Chỉ xuất kho từ Đang soạn');
      if (o.lockedById && o.lockedById !== actorId) throw new ConflictException(`Đơn đang do ${o.lockedById} soạn`);
      if (o.version !== version) throw new ConflictException('Đơn đã bị sửa bởi người khác, tải lại');
      for (const it of o.items) {
        if (!it.variantId) { // dòng tay: chốt xuất luôn, không trừ tồn
          await tx.orderItem.update({ where: { id: it.id }, data: { exportedQty: it.qty, heldQty: 0 } });
          continue;
        }
        let stock = await tx.inventoryStock.findFirst({ where: { variantId: it.variantId!, warehouse: (it as any).warehouse || 'KHO_CHINH' } });
        if (!stock || stock.onHand < it.qty) throw new ConflictException(`Không đủ tồn ${it.variantId}`);
        await tx.$queryRawUnsafe(`SELECT id FROM "InventoryStock" WHERE id=$1 FOR UPDATE`, stock.id);
        stock = (await tx.inventoryStock.findUnique({ where: { id: stock.id } }))!;
        if (stock.onHand < it.qty || stock.held < it.heldQty) throw new ConflictException(`Tồn kho ${it.variantId} đã thay đổi, thử lại`);
        await tx.inventoryStock.update({ where: { id: stock.id }, data: { onHand: stock.onHand - it.qty, held: Math.max(0, stock.held - it.heldQty) } });
        await tx.orderItem.update({ where: { id: it.id }, data: { exportedQty: it.qty, heldQty: 0 } });
        await tx.inventoryTransaction.create({ data: { variantId: it.variantId, type: 'OUT', qty: it.qty, refCode: o.code, actorId } });
      }
      return tx.order.update({ where: { id }, data: { status: 'XUAT_KHO', version: { increment: 1 }, lockedById: null, lockedAt: null, history: { create: { fromStatus: 'DANG_SOAN', toStatus: 'XUAT_KHO', actorId } } } });
    });
  }

  async transition(id: string, to: any, actorId: string, note?: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const o = await tx.order.findUnique({ where: { id }, include: { items: true, invoice: true } });
      if (!o) throw new NotFoundException('Không thấy đơn');
      if (!canTransition(o.status, to)) throw new BadRequestException(`${o.status} -> ${to} không hợp lệ`);
      if (to === 'DANG_SOAN' || to === 'XUAT_KHO' || to === 'VAN_CHUYEN' || to === 'HOA_DON') {
        throw new BadRequestException('Phải dùng đúng thao tác giữ tồn, xuất kho, vận chuyển hoặc sinh hóa đơn');
      }
      if (to === 'HUY') {
        for (const it of o.items) {
          if (!it.heldQty || !it.variantId) continue;
          const stock = await tx.inventoryStock.findFirst({ where: { variantId: it.variantId, warehouse: it.warehouse } });
          if (stock) {
            await tx.$queryRawUnsafe(`SELECT id FROM "InventoryStock" WHERE id=$1 FOR UPDATE`, stock.id);
            const current = (await tx.inventoryStock.findUnique({ where: { id: stock.id } }))!;
            await tx.inventoryStock.update({ where: { id: stock.id }, data: { held: Math.max(0, current.held - it.heldQty) } });
            await tx.inventoryTransaction.create({ data: { variantId: it.variantId, type: 'RELEASE', qty: it.heldQty, refCode: o.code, actorId, note: 'Hủy đơn' } });
          }
          await tx.orderItem.update({ where: { id: it.id }, data: { heldQty: 0 } });
        }
      }
      if (to === 'HOAN_TAT' && o.invoice && o.invoice.status !== 'PAID') {
        throw new BadRequestException('Hóa đơn chưa thanh toán đủ');
      }
      return tx.order.update({ where: { id }, data: { status: to, lockedById: null, lockedAt: null, history: { create: { fromStatus: o.status, toStatus: to, actorId, note } } } });
    });
  }

  // Sửa thông tin chung: cho tới trước Vận chuyển (sau đó khóa để giữ đối soát)
  async update(id: string, dto: { note?: string; customerNote?: string; staffNote?: string; shipDate?: string; type?: string; urgent?: boolean }, actorId: string) {
    const o = await this.prisma.order.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Không thấy đơn');
    if (['VAN_CHUYEN', 'HOA_DON', 'HOAN_TAT'].includes(o.status)) {
      throw new BadRequestException('Đơn đã đi giao, không sửa nữa (tạo hàng trả nếu cần)');
    }
    const old = { note: o.note, shipDate: o.shipDate, type: o.type };
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        note: dto.note ?? o.note, customerNote: dto.customerNote ?? o.customerNote,
        staffNote: dto.staffNote ?? o.staffNote, urgent: dto.urgent ?? o.urgent,
        shipDate: dto.shipDate ? new Date(dto.shipDate) : o.shipDate,
        type: dto.type || o.type, version: { increment: 1 },
      },
    });
    await this.prisma.auditLog.create({ data: { actorId, action: 'ORDER_EDIT', entityType: 'Order', entityId: id, payload: { old, new: dto } as any } });
    return updated;
  }

  // Thêm dòng hàng: chỉ khi Mới (chưa giữ tồn) — tính lại tổng
  async addItem(id: string, dto: any, actorId: string) {
    if (!Number.isInteger(Number(dto.qty)) || Number(dto.qty) <= 0 || !Number.isFinite(Number(dto.unitPrice)) || Number(dto.unitPrice) < 0) {
      throw new BadRequestException('Số lượng phải là số nguyên > 0 và đơn giá không được âm');
    }
    return this.prisma.$transaction(async (tx: any) => {
      const o = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!o) throw new NotFoundException('Không thấy đơn');
      if (o.status !== 'MOI') throw new BadRequestException('Chỉ thêm dòng khi đơn còn Mới (nhả giữ trước)');
      const item = await tx.orderItem.create({
        data: {
          orderId: id, variantId: dto.variantId || null,
          productName: dto.variantId ? null : dto.productName || null,
          color: dto.variantId ? null : dto.color || null, size: dto.variantId ? null : dto.size || null,
          warehouse: dto.warehouse || 'KHO_CHINH', qty: Number(dto.qty), unitPrice: Number(dto.unitPrice),
          saleType: dto.saleType || null, imageUrl: dto.imageUrl || null, note: dto.note || null,
        },
      });
      const total = o.items.reduce((s: number, i: any) => s + i.qty * Number(i.unitPrice), 0) + item.qty * Number(item.unitPrice);
      await tx.order.update({ where: { id }, data: { total, version: { increment: 1 } } });
      await tx.auditLog.create({ data: { actorId, action: 'ORDER_ADD_ITEM', entityType: 'Order', entityId: id, payload: { itemId: item.id } as any } });
      return item;
    });
  }

  // Xóa dòng hàng: chỉ khi Mới và chưa giữ/xuất
  async removeItem(id: string, itemId: string, actorId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const o = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!o) throw new NotFoundException('Không thấy đơn');
      if (o.status !== 'MOI') throw new BadRequestException('Chỉ xóa dòng khi đơn còn Mới');
      const it = o.items.find((i: any) => i.id === itemId);
      if (!it) throw new NotFoundException('Không thấy dòng');
      if (it.heldQty || it.exportedQty) throw new BadRequestException('Dòng đã giữ/xuất tồn, nhả giữ trước');
      await tx.orderItem.delete({ where: { id: itemId } });
      const total = o.items.filter((i: any) => i.id !== itemId).reduce((s: number, i: any) => s + i.qty * Number(i.unitPrice), 0);
      await tx.order.update({ where: { id }, data: { total, version: { increment: 1 } } });
      await tx.auditLog.create({ data: { actorId, action: 'ORDER_REMOVE_ITEM', entityType: 'Order', entityId: id, payload: { itemId } as any } });
      return { ok: true };
    });
  }
}
