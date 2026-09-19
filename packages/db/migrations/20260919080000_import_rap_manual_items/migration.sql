-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_variantId_fkey";

-- DropForeignKey
ALTER TABLE "Return" DROP CONSTRAINT "Return_orderId_fkey";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "color" TEXT,
ADD COLUMN     "productName" TEXT,
ADD COLUMN     "size" TEXT,
ALTER COLUMN "variantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Return" ADD COLUMN     "code" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReturnItem" ADD COLUMN     "color" TEXT,
ADD COLUMN     "productName" TEXT,
ADD COLUMN     "size" TEXT,
ALTER COLUMN "variantId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RapPattern" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RapPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapPhieuNhap" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ngayCat" TIMESTAMP(3),
    "nhaMay" TEXT,
    "thoCat" TEXT,
    "maRap" TEXT,
    "tongSL" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Mới tạo',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RapPhieuNhap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapSizeKeHoach" (
    "id" TEXT NOT NULL,
    "mam" TEXT NOT NULL,
    "maRap" TEXT,
    "color" TEXT,
    "size" TEXT,
    "soLop" INTEGER NOT NULL DEFAULT 0,
    "slKeHoach" INTEGER NOT NULL DEFAULT 0,
    "maHangNoiBo" TEXT,
    "tenSP" TEXT,
    "phieuId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RapSizeKeHoach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RapPattern_code_key" ON "RapPattern"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RapPhieuNhap_code_key" ON "RapPhieuNhap"("code");

-- CreateIndex
CREATE INDEX "RapPhieuNhap_maRap_idx" ON "RapPhieuNhap"("maRap");

-- CreateIndex
CREATE INDEX "RapSizeKeHoach_mam_idx" ON "RapSizeKeHoach"("mam");

-- CreateIndex
CREATE INDEX "RapSizeKeHoach_maRap_idx" ON "RapSizeKeHoach"("maRap");

-- CreateIndex
CREATE UNIQUE INDEX "Return_code_key" ON "Return"("code");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapSizeKeHoach" ADD CONSTRAINT "RapSizeKeHoach_phieuId_fkey" FOREIGN KEY ("phieuId") REFERENCES "RapPhieuNhap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

