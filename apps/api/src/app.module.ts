import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { PrismaService } from './common/prisma.service';
import { AuthGuard } from './common/auth.guard';
import { CustomersModule } from './modules/customers/customers.module';
import { OrdersModule } from './modules/orders/orders.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { FactoriesModule } from './modules/factories/factories.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { HrModule } from './modules/hr/hr.module';
import { ReportsController } from './modules/reports.controller';
import { AuditController } from './modules/audit.controller';
import { RapController } from './modules/rap.controller';
import { SystemExtraController } from './modules/system-extra.controller';
import { PermissionsController } from './modules/permissions.controller';

@Module({
  imports: [JwtModule.register({}), AuthModule, CustomersModule, OrdersModule, InventoryModule, FactoriesModule, MaterialsModule, HrModule],
  controllers: [HealthController, ReportsController, AuditController, RapController, SystemExtraController, PermissionsController],
  providers: [PrismaService, AuthGuard, Reflector],
})
export class AppModule {}
