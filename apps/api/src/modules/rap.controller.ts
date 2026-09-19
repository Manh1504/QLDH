import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../common/auth.guard';
import { parsePaging } from '../common/pagination';

// Rập: mẫu rập, phiếu nhập rập, size kế hoạch, mâm (bản cũ: rap-menu/rap-them/rap-xem)
@Controller()
@UseGuards(AuthGuard)
export class RapController {
  constructor(private prisma: PrismaService) {}

  @Get('rap/patterns')
  patterns(@Query('q') q: string) {
    return this.prisma.rapPattern.findMany({
      where: q ? { code: { contains: q, mode: 'insensitive' } } : {},
      take: 30, orderBy: { code: 'asc' },
    });
  }

  @Get('rap/phieu')
  phieu(@Query() q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const where: any = {};
    if (q.maRap) where.maRap = { contains: q.maRap, mode: 'insensitive' };
    if (q.nhaMay) where.nhaMay = { contains: q.nhaMay, mode: 'insensitive' };
    return this.prisma.$transaction([
      this.prisma.rapPhieuNhap.count({ where }),
      this.prisma.rapPhieuNhap.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { sizes: true } }),
    ]).then(([total, data]: [number, any[]]) => ({ data, total, page, pageSize }));
  }

  @Post('rap/phieu')
  createPhieu(@Body() b: { code?: string; ngayCat?: string; nhaMay?: string; thoCat?: string; maRap?: string; status?: string; note?: string; sizes?: { mam?: string; color?: string; size?: string; soLop?: number; slKeHoach?: number; maHangNoiBo?: string; tenSP?: string }[] }) {
    const code = b.code || `PNR-${Date.now()}`;
    return this.prisma.rapPhieuNhap.create({
      data: {
        code, ngayCat: b.ngayCat ? new Date(b.ngayCat) : null,
        nhaMay: b.nhaMay, thoCat: b.thoCat, maRap: b.maRap,
        tongSL: (b.sizes || []).reduce((s: number, x: any) => s + (x.slKeHoach || 0), 0),
        status: b.status || 'Mới tạo', note: b.note,
        sizes: { create: (b.sizes || []).map((s: any) => ({ mam: s.mam || code, maRap: b.maRap, color: s.color, size: s.size, soLop: s.soLop || 0, slKeHoach: s.slKeHoach || 0, maHangNoiBo: s.maHangNoiBo, tenSP: s.tenSP })) },
      },
      include: { sizes: true },
    });
  }

  @Get('rap/sizes')
  sizes(@Query() q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const where: any = {};
    if (q.mam) where.mam = { contains: q.mam, mode: 'insensitive' };
    if (q.maRap) where.maRap = { contains: q.maRap, mode: 'insensitive' };
    return this.prisma.$transaction([
      this.prisma.rapSizeKeHoach.count({ where }),
      this.prisma.rapSizeKeHoach.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    ]).then(([total, data]: [number, any[]]) => ({ data, total, page, pageSize }));
  }
}
