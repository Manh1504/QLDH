import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { parsePaging } from '../../common/pagination';

// Sổ nợ nhà may/thợ cắt: full history phân trang + filter tháng/trạng thái (fix giới hạn 10-15 dòng bản cũ)
@Injectable()
export class FactoriesService {
  constructor(private prisma: PrismaService) {}

  factories(q: any) {
    const kw = (q.q || '').trim();
    return this.prisma.factory.findMany({
      where: kw ? { name: { contains: kw, mode: 'insensitive' } } : {},
      take: 50, orderBy: { name: 'asc' },
    });
  }

  createFactory(code: string, name: string) {
    return this.prisma.factory.create({ data: { code, name } });
  }

  settle(factoryId: string, code: string, amount: number, note?: string) {
    if (!code?.trim() || !Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Mã chốt và số tiền phải hợp lệ');
    return this.prisma.factorySettlement.create({ data: { factoryId, code, amount, note } });
  }

  pay(factoryId: string, amount: number, settlementId?: string, method?: string, note?: string) {
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Số tiền trả phải > 0');
    return this.prisma.$transaction(async (tx) => {
      const settlements = await tx.factorySettlement.findMany({
        where: settlementId ? { id: settlementId, factoryId } : { factoryId, status: { not: 'DONE' } },
        orderBy: { createdAt: 'asc' },
      });
      if (settlementId && !settlements.length) throw new BadRequestException('Chốt không thuộc nhà may');
      const debt = settlements.reduce((sum, settlement) => sum + Math.max(0, Number(settlement.amount) - Number(settlement.paid)), 0);
      if (amount > debt) throw new BadRequestException(`Số tiền vượt công nợ ${debt.toLocaleString('vi-VN')}đ`);
      const p = await tx.factoryPayment.create({ data: { factoryId, amount, settlementId, method, note } });
      let remaining = amount;
      for (const settlement of settlements) {
        if (remaining <= 0) break;
        const outstanding = Number(settlement.amount) - Number(settlement.paid);
        const allocated = Math.min(outstanding, remaining);
        const paid = Number(settlement.paid) + allocated;
        const total = Number(settlement.amount);
        await tx.factorySettlement.update({ where: { id: settlement.id }, data: { paid, status: paid <= 0 ? 'OPEN' : paid < total ? 'PARTIAL' : 'DONE' } });
        remaining -= allocated;
      }
      return p;
    });
  }

  // Toàn bộ lịch sử đã thanh toán + còn nợ, phân trang thật
  settlementHistory(factoryId: string, q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const where: any = { factoryId };
    if (q.status) where.status = q.status;
    if (q.month) {
      const from = new Date(`${q.month}-01T00:00:00`);
      const to = new Date(from); to.setMonth(to.getMonth() + 1);
      where.createdAt = { gte: from, lt: to };
    }
    return this.prisma.$transaction([
      this.prisma.factorySettlement.count({ where }),
      this.prisma.factorySettlement.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    ]).then(([total, data]) => ({ data, total, page, pageSize }));
  }

  paymentHistory(factoryId: string, q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const where: any = { factoryId };
    return this.prisma.$transaction([
      this.prisma.factoryPayment.count({ where }),
      this.prisma.factoryPayment.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    ]).then(([total, data]) => ({ data, total, page, pageSize }));
  }

  cutters(q: any) {
    const kw = (q.q || '').trim();
    return this.prisma.cutter.findMany({
      where: kw ? { name: { contains: kw, mode: 'insensitive' } } : {},
      take: 50, orderBy: { name: 'asc' },
    });
  }

  createCutter(code: string, name: string) {
    return this.prisma.cutter.create({ data: { code, name } });
  }

  cutterTxn(cutterId: string, type: any, amount: number, month: string, note?: string) {
    if (!['CHOT', 'UNG', 'TRU_NO'].includes(type) || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('Giao dịch thợ cắt không hợp lệ');
    return this.prisma.cutterTransaction.create({ data: { cutterId, type, amount, month, note } });
  }

  cutterHistory(cutterId: string, q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const where: any = { cutterId };
    if (q.month) where.month = q.month;
    if (q.type) where.type = q.type;
    return this.prisma.$transaction([
      this.prisma.cutterTransaction.count({ where }),
      this.prisma.cutterTransaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    ]).then(([total, data]) => ({ data, total, page, pageSize }));
  }
}
