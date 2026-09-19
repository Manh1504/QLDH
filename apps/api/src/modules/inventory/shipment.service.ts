import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ShipmentService {
  constructor(private prisma: PrismaService) {}

  async create(orderId: string, carrier: string, actorId = 'system') {
    const o = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!o || o.status !== 'XUAT_KHO') throw new BadRequestException('Chỉ tạo vận chuyển từ Xuất kho');
    if (!carrier?.trim()) throw new BadRequestException('Chưa nhập chành xe');
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.shipment.create({ data: { orderId, carrier: carrier.trim(), history: [{ at: new Date().toISOString(), by: actorId, event: 'CREATED' }] as any } });
      await tx.order.update({ where: { id: orderId }, data: { status: 'VAN_CHUYEN', history: { create: { fromStatus: 'XUAT_KHO', toStatus: 'VAN_CHUYEN', actorId } } } });
      return s;
    });
  }

  async updateStatus(id: string, status: any, actorId = 'system', note?: string) {
    const s = await this.prisma.shipment.findUnique({ where: { id } });
    if (!s) throw new BadRequestException('Không thấy vận chuyển');
    const allowed: Record<string, string[]> = { CREATED: ['SHIPPING', 'FAILED'], SHIPPING: ['DELIVERED', 'FAILED'], FAILED: ['SHIPPING'], DELIVERED: [] };
    if (!allowed[s.status]?.includes(status)) throw new BadRequestException(`${s.status} -> ${status} không hợp lệ`);
    const hist = Array.isArray(s.history) ? [...s.history] : [];
    hist.push({ at: new Date().toISOString(), by: actorId, event: status, note } as any);
    return this.prisma.shipment.update({ where: { id }, data: { status, history: hist as any } });
  }
}
