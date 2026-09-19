// Wipe toàn bộ data import (giữ bảng User). Chỉ dùng khi DB chưa có data người dùng thật.
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function m() {
  await p.$executeRawUnsafe(
    `TRUNCATE "OrderStatusHistory","OrderImage","OrderItem","ReturnItem","Return","Invoice","Shipment","CustomerPayment","Order","Customer","InventoryTransaction","InventoryStock","StockAdjustRequest","ProductVariant","Product","FactorySettlement","FactoryPayment","Factory","CutterTransaction","Cutter","RapSizeKeHoach","RapPhieuNhap","RapPattern","MaterialTransaction","MaterialSupplier","Attendance","SalaryAdvance","Employee","AuditLog" CASCADE`,
  );
  console.log('wiped');
}
m().finally(() => p.$disconnect());
