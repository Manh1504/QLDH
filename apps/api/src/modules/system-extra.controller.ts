import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../common/auth.guard';
import { parsePaging } from '../common/pagination';

// Kho ảnh toàn hệ thống + cảnh báo (bản cũ: tat-ca-anh, warnGetDataIssues, azMngExecutiveAlerts)
@Controller()
@UseGuards(AuthGuard)
export class SystemExtraController {
  constructor(private prisma: PrismaService) {}

  // Tất cả ảnh mọi đơn, sort ở SQL, phân trang
  @Get('images')
  allImages(@Query() q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const orderBy = q.sort === 'oldest' ? { createdAt: 'asc' as const } : { createdAt: 'desc' as const };
    return this.prisma.$transaction([
      this.prisma.orderImage.count(),
      this.prisma.orderImage.findMany({ orderBy, skip, take: pageSize, include: { order: { select: { code: true } } } }),
    ]).then(([total, data]) => ({ data, total, page, pageSize, sort: q.sort || 'newest' }));
  }

  // Cảnh báo: tồn khả dụng thấp, nợ khách cao, đơn kẹt Đang soạn quá 3 ngày
  @Get('alerts')
  async alerts() {
    const lowStock: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT v."internalCode", v."salesCode", s.warehouse, (s."onHand"-s.held)::int AS khadung
       FROM "InventoryStock" s JOIN "ProductVariant" v ON v.id=s."variantId"
       WHERE (s."onHand"-s.held) < 10 ORDER BY khadung ASC LIMIT 50`,
    );
    const highDebt: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT c."code", c."name", COALESCE(SUM(o."total"-o."paid"),0)::float AS debt
       FROM "Customer" c LEFT JOIN "Order" o ON o."customerId"=c.id
       GROUP BY c."code",c."name" HAVING COALESCE(SUM(o."total"-o."paid"),0) > 1000000 ORDER BY debt DESC LIMIT 50`,
    );
    const stuck: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT code, "lockedById", "lockedAt" FROM "Order" WHERE status='DANG_SOAN' AND "lockedAt" < NOW() - INTERVAL '3 days' LIMIT 50`,
    );
    return { lowStock, highDebt, stuck };
  }

  // Hóa đơn: list + lọc trạng thái (bản cũ: bill-detail/van-chuyen)
  @Get('invoices')
  invoices(@Query() q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const where: any = { deletedAt: null };
    if (q.status) where.status = q.status;
    return this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { order: { select: { code: true, customerId: true, customer: { select: { name: true } } } } } }),
    ]).then(([total, data]) => ({ data, total, page, pageSize }));
  }

  @Get('shipments')
  shipments(@Query() q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const where: any = {};
    if (q.status) where.status = q.status;
    return this.prisma.$transaction([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { order: { select: { code: true } } } }),
    ]).then(([total, data]) => ({ data, total, page, pageSize }));
  }
}
