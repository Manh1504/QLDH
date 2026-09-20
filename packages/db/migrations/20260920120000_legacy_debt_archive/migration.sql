ALTER TABLE "Customer"
  ADD COLUMN "debtBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "zalo" TEXT,
  ADD COLUMN "note" TEXT,
  ADD COLUMN "sourceUpdatedAt" TIMESTAMPTZ;

UPDATE "Customer" c
SET "debtBalance" = COALESCE((
  SELECT SUM(o.total - o.paid)
  FROM "Order" o
  WHERE o."customerId" = c.id AND o.status <> 'HUY'
), 0);

ALTER TABLE "Order"
  ADD COLUMN "invoiceState" TEXT,
  ADD COLUMN "salesChannel" TEXT,
  ADD COLUMN "sourceType" TEXT,
  ADD COLUMN "preparedBy" TEXT,
  ADD COLUMN "creatorName" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMPTZ,
  ADD COLUMN "cancelledBy" TEXT,
  ADD COLUMN "completedAt" TIMESTAMPTZ,
  ADD COLUMN "sourceUpdatedAt" TIMESTAMPTZ;

ALTER TABLE "OrderImage"
  ADD COLUMN "sourceId" TEXT,
  ADD COLUMN "folderId" TEXT,
  ADD COLUMN "note" TEXT;

ALTER TABLE "Return"
  ADD COLUMN "totalReturn" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "inspector" TEXT,
  ADD COLUMN "sourceUpdatedAt" TIMESTAMPTZ;

ALTER TABLE "CustomerPayment"
  ADD COLUMN "collectedBy" TEXT,
  ADD COLUMN "sourceReference" TEXT,
  ADD CONSTRAINT "CustomerPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PaymentAllocation" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_orderId_key" ON "PaymentAllocation"("paymentId", "orderId");
CREATE INDEX "PaymentAllocation_orderId_idx" ON "PaymentAllocation"("orderId");
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CustomerPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DebtTransaction" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "customerId" TEXT,
  "subjectCode" TEXT NOT NULL,
  "subjectName" TEXT,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "note" TEXT,
  "actorName" TEXT,
  "documentCode" TEXT,
  "subjectGroup" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "DebtTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DebtTransaction_sourceKey_key" ON "DebtTransaction"("sourceKey");
CREATE INDEX "DebtTransaction_customerId_createdAt_idx" ON "DebtTransaction"("customerId", "createdAt");
CREATE INDEX "DebtTransaction_subjectCode_createdAt_idx" ON "DebtTransaction"("subjectCode", "createdAt");
ALTER TABLE "DebtTransaction" ADD CONSTRAINT "DebtTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
