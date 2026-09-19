import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersController } from './users.controller';
import { PrismaService } from '../common/prisma.service';
import { AuthGuard } from '../common/auth.guard';
import { Reflector } from '@nestjs/core';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, UsersController],
  providers: [AuthService, PrismaService, AuthGuard, Reflector],
})
export class AuthModule {}
