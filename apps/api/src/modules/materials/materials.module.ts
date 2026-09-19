import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/prisma.service';
import { AuthGuard } from '../../common/auth.guard';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [MaterialsController],
  providers: [MaterialsService, PrismaService, AuthGuard, Reflector],
})
export class MaterialsModule {}
