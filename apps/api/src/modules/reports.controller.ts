import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../common/auth.guard';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private prisma: PrismaService) {}

  @Get('cashflow')
  async cashflow(@Query() q: any) {
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 864e5);
    const to = q.to ? new Date(q.to) : new Date();
    const [orders, payments, factoryPay, matTx] = await Promise.all([
      this.prisma.order.aggregate({ where: { createdAt: { gte: from, lte: to } }, _sum: { total: true, paid: true } }),
      this.prisma.customerPayment.aggregate({ where: { createdAt: { gte: from, lte: to } }, _sum: { amount: true } }),
      this.prisma.factoryPayment.aggregate({ where: { createdAt: { gte: from, lte: to } }, _sum: { amount: true } }),
      this.prisma.materialTransaction.aggregate({ where: { createdAt: { gte: from, lte: to } }, _sum: { amount: true } }),
    ]);
    return { from, to, orders, customerPayments: payments, factoryPayments: factoryPay, materialTx: matTx };
  }

  @Get('debt-center')
  async debtCenter() {
    const customers: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT c."code", c."name", c."debtBalance"::float AS debt FROM "Customer" c WHERE c."debtBalance" > 0 ORDER BY c."debtBalance" DESC LIMIT 100`,
    );
    const factories: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT f."name", COALESCE(SUM(s."amount"-s."paid"),0)::float AS debt FROM "Factory" f LEFT JOIN "FactorySettlement" s ON s."factoryId"=f.id GROUP BY f."name" HAVING COALESCE(SUM(s."amount"-s."paid"),0) > 0 ORDER BY debt DESC LIMIT 100`,
    );
    return { customers, factories };
  }

  @Get('profit')
  async profit(@Query() q: any) {
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 864e5);
    const to = q.to ? new Date(q.to) : new Date();
    const orders = await this.prisma.order.aggregate({ where: { createdAt: { gte: from, lte: to }, status: { in: ['HOA_DON', 'HOAN_TAT'] } }, _sum: { total: true } });
    return { from, to, revenue: orders._sum.total || 0 };
  }
}
