import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuthGuard } from '../../common/auth.guard';
import { parsePaging } from '../../common/pagination';

@Controller('payments')
@UseGuards(AuthGuard)
export class PaymentsController {
  constructor(private prisma: PrismaService) {}

  // Thu tiền khách (trừ nợ), có thể gắn vào đơn cụ thể
  @Post()
  async collect(@Req() req: any, @Body() b: { customerId: string; orderId?: string; amount: number; method?: string; note?: string }) {
    const amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Số tiền thu phải > 0');
    return this.prisma.$transaction(async (tx: any) => {
      const customer = await tx.customer.findUnique({ where: { id: b.customerId } });
      if (!customer) throw new BadRequestException('Không thấy khách hàng');
      const orders = b.orderId
        ? await tx.order.findMany({ where: { id: b.orderId, customerId: b.customerId, status: { not: 'HUY' } }, include: { invoice: true } })
        : await tx.order.findMany({ where: { customerId: b.customerId, status: { not: 'HUY' } }, orderBy: { createdAt: 'asc' }, include: { invoice: true } });
      if (b.orderId && !orders.length) throw new BadRequestException('Đơn không thuộc khách hàng');
      const outstanding = orders.reduce((sum: number, order: any) => sum + Math.max(0, Number(order.total) - Number(order.paid)), 0);
      if (amount > outstanding) throw new BadRequestException(`Số tiền thu vượt công nợ ${outstanding.toLocaleString('vi-VN')}đ`);
      const p = await tx.customerPayment.create({ data: { customerId: b.customerId, orderId: b.orderId, amount, method: b.method, note: b.note } });
      let remaining = amount;
      const allocations: { orderId: string; amount: number }[] = [];
      for (const order of orders) {
        if (remaining <= 0) break;
        const debt = Math.max(0, Number(order.total) - Number(order.paid));
        if (!debt) continue;
        const allocated = Math.min(debt, remaining);
        const paid = Number(order.paid) + allocated;
        await tx.order.update({ where: { id: order.id }, data: { paid, history: { create: { fromStatus: order.status, toStatus: order.status, actorId: req.user.sub, note: `Thu ${allocated}` } } } });
        if (order.invoice && !order.invoice.deletedAt) {
          const invoiceTotal = Number(order.invoice.total);
          const invoicePaid = Math.min(invoiceTotal, Number(order.invoice.paid) + allocated);
          const status = invoicePaid <= 0 ? 'UNPAID' : invoicePaid < invoiceTotal ? 'PARTIAL' : 'PAID';
          await tx.invoice.update({ where: { id: order.invoice.id }, data: { paid: invoicePaid, status } });
        }
        allocations.push({ orderId: order.id, amount: allocated });
        remaining -= allocated;
      }
      await tx.auditLog.create({ data: { actorId: req.user.sub, action: 'PAYMENT_COLLECT', entityType: 'Customer', entityId: b.customerId, payload: { amount, orderId: b.orderId, allocations } as any } });
      return p;
    });
  }

  @Get()
  history(@Query() q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const where: any = {};
    if (q.customerId) where.customerId = q.customerId;
    return this.prisma.$transaction([
      this.prisma.customerPayment.count({ where }),
      this.prisma.customerPayment.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    ]).then(([total, data]: [number, any[]]) => ({ data, total, page, pageSize }));
  }

  @Get('customer/:id')
  customerDebt(@Param('id') id: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(o."total"),0)::float AS total, COALESCE(SUM(o."paid"),0)::float AS paidOrders,
       (SELECT COALESCE(SUM(amount),0)::float FROM "CustomerPayment" WHERE "customerId"=$1) AS paidDirect
       FROM "Order" o WHERE o."customerId"=$1 AND o.status <> 'HUY'`,
      id,
    ).then((r: any) => r[0]);
  }
}
