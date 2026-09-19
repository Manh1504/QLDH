import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class InvoiceService {
  constructor(private prisma: PrismaService) {}

  async create(orderId: string, photoUrl: string | undefined, actorId: string) {
    const o = await this.prisma.order.findUnique({ where: { id: orderId }, include: { invoice: true } });
    if (!o || !['VAN_CHUYEN', 'XUAT_KHO'].includes(o.status)) throw new BadRequestException('Chỉ sinh hóa đơn từ Vận chuyển/Xuất kho');
    if (o.invoice) throw new BadRequestException('Đã có hóa đơn');
    return this.prisma.$transaction(async (tx: any) => {
      const paid = Number(o.paid);
      const total = Number(o.total);
      const status = paid <= 0 ? 'UNPAID' : paid < total ? 'PARTIAL' : 'PAID';
      const inv = await tx.invoice.create({ data: { orderId, total: o.total, paid: o.paid, status, photoUrl } });
      await tx.order.update({ where: { id: orderId }, data: { status: 'HOA_DON', history: { create: { fromStatus: o.status, toStatus: 'HOA_DON', actorId } } } });
      return inv;
    });
  }

  async get(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { order: { include: { customer: true, items: { include: { variant: true } } } } } });
    if (!invoice || invoice.deletedAt) throw new NotFoundException('Không thấy hóa đơn');
    return invoice;
  }

  // Sửa hóa đơn: lưu vết cũ vào AuditLog, không ghi đè mất dấu
  async update(id: string, patch: { total?: number; paid?: number; photoUrl?: string }, actorId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const old = await tx.invoice.findUnique({ where: { id } });
      if (!old || old.deletedAt) throw new BadRequestException('Hóa đơn không hợp lệ');
      await tx.auditLog.create({ data: { actorId, action: 'INVOICE_EDIT', entityType: 'Invoice', entityId: id, payload: { old, patch } as any } });
      const total = patch.total ?? Number(old.total);
      const paid = patch.paid ?? Number(old.paid);
      if (!Number.isFinite(total) || total < 0 || !Number.isFinite(paid) || paid < 0 || paid > total) {
        throw new BadRequestException('Tổng/đã trả không hợp lệ');
      }
      const status = paid <= 0 ? 'UNPAID' : paid < total ? 'PARTIAL' : 'PAID';
      const updated = await tx.invoice.update({ where: { id }, data: { total, paid, status: status as any, photoUrl: patch.photoUrl, editedBy: actorId, editedAt: new Date() } });
      await tx.order.update({ where: { id: old.orderId }, data: { total, paid } });
      return updated;
    });
  }

  remove(id: string, actorId: string, reason: string) {
    return this.prisma.$transaction(async (tx: any) => {
      await tx.auditLog.create({ data: { actorId, action: 'INVOICE_VOID', entityType: 'Invoice', entityId: id, payload: { reason } as any } });
      return tx.invoice.update({ where: { id }, data: { deletedAt: new Date(), status: 'VOID' } });
    });
  }
}
