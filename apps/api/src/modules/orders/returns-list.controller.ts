import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuthGuard } from '../../common/auth.guard';
import { parsePaging } from '../../common/pagination';

@Controller('returns')
@UseGuards(AuthGuard)
export class ReturnsListController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list(@Query() q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const where: any = {};
    if (q.status) where.status = q.status;
    return this.prisma.$transaction([
      this.prisma.return.count({ where }),
      this.prisma.return.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { items: true, order: { select: { code: true } }, customer: { select: { name: true } } } }),
    ]).then(([total, data]) => ({ data, total, page, pageSize }));
  }
}
