import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/prisma.service';
import { AuthGuard } from '../../common/auth.guard';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReturnsController } from './returns.controller';
import { ReturnsListController } from './returns-list.controller';
import { ReturnsService } from './returns.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [OrdersController, ReturnsController, ReturnsListController, UploadsController],
  providers: [OrdersService, ReturnsService, UploadsService, PrismaService, AuthGuard, Reflector],
  exports: [OrdersService, ReturnsService],
})
export class OrdersModule {}
