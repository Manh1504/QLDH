import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/prisma.service';
import { AuthGuard } from '../../common/auth.guard';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from './shipment.service';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { StockLedgerController } from './ledger.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [InventoryController, ShipmentController, InvoiceController, StockLedgerController],
  providers: [InventoryService, ShipmentService, InvoiceService, PrismaService, AuthGuard, Reflector],
})
export class InventoryModule {}
