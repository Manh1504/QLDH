import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/prisma.service';
import { AuthGuard } from '../../common/auth.guard';
import { FactoriesController } from './factories.controller';
import { FactoriesService } from './factories.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [FactoriesController],
  providers: [FactoriesService, PrismaService, AuthGuard, Reflector],
})
export class FactoriesModule {}
