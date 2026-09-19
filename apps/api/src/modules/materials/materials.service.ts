import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { parsePaging } from '../../common/pagination';

@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  suppliers(q: any) {
    const where: any = {};
    if (q.category) where.category = q.category;
    if (q.q) where.name = { contains: q.q, mode: 'insensitive' };
    return this.prisma.materialSupplier.findMany({ where, take: 50, orderBy: { name: 'asc' } });
  }

  createSupplier(code: string, name: string, category: any, phone?: string) {
    return this.prisma.materialSupplier.create({ data: { code, name, category, phone } });
  }

  txn(supplierId: string, type: any, amount: number, note?: string) {
    if (!['NHAP', 'THANH_TOAN', 'UNG', 'CHOT'].includes(type) || !Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Giao dịch không hợp lệ');
    return this.prisma.materialTransaction.create({ data: { supplierId, type, amount, note } });
  }

  history(supplierId: string, q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const where: any = { supplierId };
    if (q.type) where.type = q.type;
    return this.prisma.$transaction([
      this.prisma.materialTransaction.count({ where }),
      this.prisma.materialTransaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    ]).then(([total, data]) => ({ data, total, page, pageSize }));
  }

  async debt(supplierId: string) {
    const transactions = await this.prisma.materialTransaction.findMany({ where: { supplierId } });
    const debt = transactions.reduce((sum, transaction) => sum + (['THANH_TOAN', 'UNG'].includes(transaction.type) ? -1 : 1) * Number(transaction.amount), 0);
    return { debt: Math.max(0, debt) };
  }
}
