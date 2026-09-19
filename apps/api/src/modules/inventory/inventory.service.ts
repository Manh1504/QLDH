import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { parsePaging } from '../../common/pagination';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // Dropdown gợi ý: gõ 2-3 ký tự -> ILIKE theo salesCode/internalCode, sort theo tồn khả dụng
  suggest(q: string) {
    const kw = `%${(q || '').trim()}%`;
    return this.prisma.productVariant.findMany({
      where: { OR: [{ salesCode: { contains: q, mode: 'insensitive' } }, { internalCode: { contains: q, mode: 'insensitive' } }] },
      take: 20, include: { product: true, stocks: true },
    });
  }

  stocks(query: any) {
    const { page, pageSize, skip } = parsePaging(query);
    const where: any = {};
    if (query.warehouse) where.warehouse = query.warehouse;
    if (query.variantId) where.variantId = query.variantId;
    return this.prisma.$transaction([
      this.prisma.inventoryStock.count({ where }),
      this.prisma.inventoryStock.findMany({ where, skip, take: pageSize, include: { variant: { include: { product: true } } }, orderBy: { variantId: 'asc' } }),
    ]).then(([total, data]) => ({ data, total, page, pageSize }));
  }

  // Nhập tay: tạo variant nếu chưa có (upsert theo internalCode), cộng tồn, ghi thẻ kho
  async inbound(input: { internalCode: string; salesCode?: string; productCode: string; productName: string; color: string; size: string; warehouse?: string; location?: string; qty: number }, actorId: string) {
    if (input.qty <= 0) throw new BadRequestException('Số lượng phải > 0');
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.upsert({
        where: { code: input.productCode },
        update: {},
        create: { code: input.productCode, name: input.productName },
      });
      const variant = await tx.productVariant.upsert({
        where: { internalCode: input.internalCode },
        update: { salesCode: input.salesCode, color: input.color, size: input.size },
        create: { internalCode: input.internalCode, salesCode: input.salesCode, productId: product.id, color: input.color, size: input.size },
      });
      const wh = input.warehouse || 'KHO_CHINH';
      const stock = await tx.inventoryStock.findFirst({ where: { variantId: variant.id, warehouse: wh, location: input.location || null } });
      if (stock) await tx.inventoryStock.update({ where: { id: stock.id }, data: { onHand: stock.onHand + input.qty } });
      else await tx.inventoryStock.create({ data: { variantId: variant.id, warehouse: wh, location: input.location, onHand: input.qty } });
      await tx.inventoryTransaction.create({ data: { variantId: variant.id, type: 'IN', qty: input.qty, refCode: `IN-${Date.now()}`, actorId, note: `${wh}` } });
      return variant;
    });
  }

  async transfer(input: { variantId: string; from: string; to: string; qty: number }, actorId: string) {
    if (!Number.isInteger(Number(input.qty)) || Number(input.qty) <= 0) throw new BadRequestException('Số lượng chuyển phải là số nguyên > 0');
    if (!input.from || !input.to || input.from === input.to) throw new BadRequestException('Kho nguồn và kho đích phải khác nhau');
    return this.prisma.$transaction(async (tx) => {
      let src = await tx.inventoryStock.findFirst({ where: { variantId: input.variantId, warehouse: input.from } });
      if (!src || src.onHand - src.held < input.qty) throw new BadRequestException('Không đủ tồn để chuyển');
      await tx.$queryRawUnsafe(`SELECT id FROM "InventoryStock" WHERE id=$1 FOR UPDATE`, src.id);
      src = (await tx.inventoryStock.findUnique({ where: { id: src.id } }))!;
      if (src.onHand - src.held < input.qty) throw new BadRequestException('Tồn kho đã thay đổi, không đủ để chuyển');
      await tx.inventoryStock.update({ where: { id: src.id }, data: { onHand: src.onHand - input.qty } });
      const dst = await tx.inventoryStock.findFirst({ where: { variantId: input.variantId, warehouse: input.to } });
      if (dst) await tx.inventoryStock.update({ where: { id: dst.id }, data: { onHand: dst.onHand + input.qty } });
      else await tx.inventoryStock.create({ data: { variantId: input.variantId, warehouse: input.to, onHand: input.qty } });
      await tx.inventoryTransaction.create({ data: { variantId: input.variantId, type: 'TRANSFER', qty: input.qty, refCode: `${input.from}->${input.to}`, actorId } });
      return { ok: true };
    });
  }

  async adjust(input: { variantId: string; warehouse: string; newQty: number; reason: string }, actorId: string) {
    if (!Number.isInteger(Number(input.newQty)) || Number(input.newQty) < 0) throw new BadRequestException('Tồn mới phải là số nguyên không âm');
    if (!input.reason?.trim()) throw new BadRequestException('Phải nhập lý do điều chỉnh');
    const s = await this.prisma.inventoryStock.findFirst({ where: { variantId: input.variantId, warehouse: input.warehouse } });
    if (!s) throw new BadRequestException('Chưa có dòng tồn');
    return this.prisma.stockAdjustRequest.create({ data: { variantId: input.variantId, warehouse: input.warehouse, location: s.location, oldQty: s.onHand, newQty: input.newQty, reason: input.reason.trim(), createdBy: actorId } });
  }

  adjustments(query: any) {
    const { page, pageSize, skip } = parsePaging(query);
    const where: any = query.status ? { status: query.status } : {};
    return this.prisma.$transaction([
      this.prisma.stockAdjustRequest.count({ where }),
      this.prisma.stockAdjustRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    ]).then(([total, data]) => ({ data, total, page, pageSize }));
  }

  approveAdjustment(id: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.stockAdjustRequest.findUnique({ where: { id } });
      if (!request || request.status !== 'PENDING') throw new BadRequestException('Yêu cầu không còn chờ duyệt');
      let stock = await tx.inventoryStock.findFirst({ where: { variantId: request.variantId, warehouse: request.warehouse, location: request.location } });
      if (!stock) throw new BadRequestException('Không thấy dòng tồn');
      await tx.$queryRawUnsafe(`SELECT id FROM "InventoryStock" WHERE id=$1 FOR UPDATE`, stock.id);
      stock = (await tx.inventoryStock.findUnique({ where: { id: stock.id } }))!;
      const diff = request.newQty - stock.onHand;
      await tx.inventoryStock.update({ where: { id: stock.id }, data: { onHand: request.newQty, version: { increment: 1 } } });
      await tx.inventoryTransaction.create({ data: { variantId: request.variantId, type: 'ADJUST', qty: diff, refCode: `ADJ-${request.id}`, actorId, note: request.reason } });
      return tx.stockAdjustRequest.update({ where: { id }, data: { status: 'APPROVED', approvedBy: actorId, oldQty: stock.onHand } });
    });
  }

  async rejectAdjustment(id: string, actorId: string) {
    const request = await this.prisma.stockAdjustRequest.findUnique({ where: { id } });
    if (!request || request.status !== 'PENDING') throw new BadRequestException('Yêu cầu không còn chờ duyệt');
    return this.prisma.stockAdjustRequest.update({ where: { id }, data: { status: 'REJECTED', approvedBy: actorId } });
  }
}
