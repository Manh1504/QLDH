import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../common/auth.guard';
import { parsePaging } from '../common/pagination';

@Controller('audit-logs')
@UseGuards(AuthGuard)
export class AuditController {
  constructor(private prisma: PrismaService) {}
  @Get()
  list(@Query() q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const where: any = {};
    if (q.entity) where.entityType = q.entity;
    if (q.entityId) where.entityId = q.entityId;
    return this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    ]).then(([total, data]) => ({ data, total, page, pageSize }));
  }
}
