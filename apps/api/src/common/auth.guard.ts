import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers['authorization'] || '';
    const [, token] = header.split(' ');
    if (!token) throw new UnauthorizedException('Thiếu token');
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'change-me-access',
      });
      req.user = payload;
    } catch {
      throw new UnauthorizedException('Token hết hạn');
    }
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles || roles.length === 0) return true;
    const userRoles: string[] = req.user?.roles || [];
    if (userRoles.includes('OWNER') || userRoles.includes('ADMIN')) return true;
    const ok = roles.some((r: any) => userRoles.includes(r));
    if (!ok) throw new ForbiddenException('Không có quyền');
    return true;
  }
}
