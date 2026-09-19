import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../common/auth.guard';
import { parsePaging } from '../common/pagination';

function isAdmin(roles: string[]) {
  return roles.includes('OWNER') || roles.includes('ADMIN');
}

@Controller()
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('users')
  async list(@Req() req: any, @Query() q: any) {
    if (!isAdmin(req.user.roles)) throw new ForbiddenException('Chỉ ADMIN');
    const { page, pageSize, skip } = parsePaging(q);
    const [total, data] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.findMany({ skip, take: pageSize, orderBy: { createdAt: 'desc' }, select: { id: true, username: true, name: true, phone: true, roles: true, status: true, createdAt: true } }),
    ]);
    return { data, total, page, pageSize };
  }

  @Post('users')
  async create(@Req() req: any, @Body() b: { username: string; password: string; name: string; phone?: string; roles?: string[] }) {
    if (!isAdmin(req.user.roles)) throw new ForbiddenException('Chỉ ADMIN');
    if ((b.roles || []).includes('OWNER') && !req.user.roles.includes('OWNER')) {
      throw new ForbiddenException('Chỉ OWNER được tạo OWNER');
    }
    const passwordHash = await argon2.hash(b.password);
    const u = await this.prisma.user.create({ data: { username: b.username, passwordHash, name: b.name, phone: b.phone, roles: b.roles || ['MEMBER'] } });
    const { passwordHash: _, ...safe } = u;
    return safe;
  }

  @Patch('users/:id/roles')
  async setRoles(@Req() req: any, @Param('id') id: string, @Body() b: { roles: string[] }) {
    if (!isAdmin(req.user.roles)) throw new ForbiddenException('Chỉ ADMIN');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (target?.roles.includes('OWNER') && !req.user.roles.includes('OWNER')) {
      throw new ForbiddenException('Không được sửa OWNER');
    }
    return this.prisma.user.update({ where: { id }, data: { roles: b.roles }, select: { id: true, username: true, name: true, roles: true, status: true } });
  }

  @Patch('users/:id/status')
  async setStatus(@Req() req: any, @Param('id') id: string, @Body() b: { status: string }) {
    if (!isAdmin(req.user.roles)) throw new ForbiddenException('Chỉ ADMIN');
    return this.prisma.user.update({ where: { id }, data: { status: b.status as any }, select: { id: true, username: true, status: true } });
  }

  @Post('auth/change-password')
  async changePw(@Req() req: any, @Body() b: { oldPassword: string; newPassword: string }) {
    const u = await this.prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!u || !(await argon2.verify(u.passwordHash, b.oldPassword))) {
      throw new ForbiddenException('Mật khẩu cũ sai');
    }
    await this.prisma.user.update({ where: { id: u.id }, data: { passwordHash: await argon2.hash(b.newPassword) } });
    return { ok: true };
  }
}
