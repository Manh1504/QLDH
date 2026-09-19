import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuthGuard } from '../../common/auth.guard';
import { parsePaging } from '../../common/pagination';

// Thẻ kho: lịch sử IN/OUT/TRANSFER/ADJUST/HOLD/RELEASE theo biến thể
@Controller('inventory')
@UseGuards(AuthGuard)
export class StockLedgerController {
  constructor(private prisma: PrismaService) {}

  @Get('ledger')
  ledger(@Query() q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const where: any = {};
    if (q.variantId) where.variantId = q.variantId;
    if (q.type) where.type = q.type;
    return this.prisma.$transaction([
      this.prisma.inventoryTransaction.count({ where }),
      this.prisma.inventoryTransaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    ]).then(([total, data]) => ({ data, total, page, pageSize }));
  }
}
