import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Sai tài khoản');
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Sai tài khoản');
    const payload = { sub: user.id, username: user.username, roles: user.roles };
    const access = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET || 'change-me-access', expiresIn: '15m',
    });
    const refresh = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'change-me-refresh', expiresIn: '7d',
    });
    return { access, refresh, user: { id: user.id, username: user.username, name: user.name, roles: user.roles } };
  }
}
