import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/prisma.service';
import { AuthGuard } from '../../common/auth.guard';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [CustomersController, PaymentsController],
  providers: [CustomersService, PrismaService, AuthGuard, Reflector],
  exports: [CustomersService],
})
export class CustomersModule {}
