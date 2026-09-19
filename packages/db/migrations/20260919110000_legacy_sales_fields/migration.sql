ALTER TABLE "Order"
  ADD COLUMN "urgent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "customerNote" TEXT,
  ADD COLUMN "staffNote" TEXT;

ALTER TABLE "OrderItem"
  ADD COLUMN "saleType" TEXT,
  ADD COLUMN "imageUrl" TEXT;

ALTER TABLE "Return"
  ADD COLUMN "inspectedAt" TIMESTAMPTZ;

ALTER TABLE "ReturnItem"
  ADD COLUMN "orderItemId" TEXT,
  ADD COLUMN "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "condition" TEXT,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "warehouse" TEXT NOT NULL DEFAULT 'KHO_CHINH',
  ADD COLUMN "location" TEXT;

CREATE INDEX "ReturnItem_orderItemId_idx" ON "ReturnItem"("orderItemId");

ALTER TABLE "Employee" ADD COLUMN "startDate" TIMESTAMPTZ;
ALTER TABLE "Attendance" ADD COLUMN "bonus" DECIMAL(65,30) NOT NULL DEFAULT 0;
