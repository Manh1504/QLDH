import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../common/auth.guard';

const MODULES = ['orders', 'customers', 'kho', 'rap', 'materials', 'hr', 'reports', 'users', 'audit'];
const DEFAULTS: Record<string, string[]> = {
  OWNER: MODULES, ADMIN: MODULES,
  BAN_HANG: ['orders', 'customers', 'reports'],
  KHO: ['kho', 'orders', 'reports'],
  RAP: ['rap', 'kho', 'reports'],
  KE_TOAN: ['orders', 'customers', 'materials', 'reports'],
  NHAN_SU: ['hr'],
  BAO_CAO: ['reports'],
  MEMBER: ['orders', 'customers'],
};

@Controller('permissions')
@UseGuards(AuthGuard)
export class PermissionsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async matrix() {
    const rows = await this.prisma.permission.findMany();
    const map: Record<string, Record<string, any>> = {};
    for (const r of rows) { (map[r.role] = map[r.role] || {})[r.module] = r; }
    return { modules: MODULES, matrix: map };
  }

  @Get('mine')
  async mine(@Req() req: any) {
    const roles: string[] = req.user.roles || [];
    if (roles.includes('OWNER') || roles.includes('ADMIN')) return { modules: MODULES };
    const rows = await this.prisma.permission.findMany({ where: { role: { in: roles }, canView: true } });
    return { modules: [...new Set(rows.map((r: any) => r.module))] };
  }

  @Patch(':role/:module')
  async set(@Req() req: any, @Param('role') role: string, @Param('module') module: string, @Body() b: any) {
    const roles: string[] = req.user.roles || [];
    if (!roles.includes('OWNER')) throw new ForbiddenException('Chỉ OWNER');
    return this.prisma.permission.upsert({
      where: { role_module: { role, module } },
      update: { canView: !!b.canView, canCreate: !!b.canCreate, canEdit: !!b.canEdit, canDelete: !!b.canDelete, canApprove: !!b.canApprove },
      create: { role, module, canView: !!b.canView, canCreate: !!b.canCreate, canEdit: !!b.canEdit, canDelete: !!b.canDelete, canApprove: !!b.canApprove },
    });
  }

  // Seed mặc định khi chưa có
  @Post('seed')
  async seed() {
    const n = await this.prisma.permission.count();
    if (n > 0) return { ok: true, seeded: false };
    for (const [role, mods] of Object.entries(DEFAULTS)) {
      for (const m of MODULES) {
        const allow = mods.includes(m);
        await this.prisma.permission.create({ data: { role, module: m, canView: allow, canCreate: allow && role !== 'BAO_CAO', canEdit: allow && role !== 'BAO_CAO', canDelete: ['OWNER', 'ADMIN'].includes(role), canApprove: ['OWNER', 'ADMIN'].includes(role) } });
      }
    }
    return { ok: true, seeded: true };
  }
}
