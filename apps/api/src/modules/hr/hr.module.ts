import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/prisma.service';
import { AuthGuard } from '../../common/auth.guard';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [HrController],
  providers: [HrService, PrismaService, AuthGuard, Reflector],
})
export class HrModule {}
