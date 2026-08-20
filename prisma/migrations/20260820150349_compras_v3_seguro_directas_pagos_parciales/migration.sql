-- CreateEnum
CREATE TYPE "PartsPurchaser" AS ENUM ('TALLER', 'SEGURO');

-- CreateEnum
CREATE TYPE "PurchasePaymentKind" AS ENUM ('PARTS', 'FREIGHT');

-- AlterEnum
ALTER TYPE "PurchaseStatus" ADD VALUE 'SEGURO';

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "budgetId" TEXT,
ADD COLUMN     "productDescription" TEXT,
ALTER COLUMN "itemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Repair" ADD COLUMN     "partsPurchaser" "PartsPurchaser";

-- CreateTable
CREATE TABLE "PurchasePayment" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "kind" "PurchasePaymentKind" NOT NULL DEFAULT 'PARTS',
    "amount" DECIMAL(14,2) NOT NULL,
    "cashMovementId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchasePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchasePayment_cashMovementId_key" ON "PurchasePayment"("cashMovementId");

-- CreateIndex
CREATE INDEX "PurchasePayment_purchaseId_idx" ON "PurchasePayment"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchasePayment_paidAt_idx" ON "PurchasePayment"("paidAt");

-- CreateIndex
CREATE INDEX "Purchase_budgetId_idx" ON "Purchase"("budgetId");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_cashMovementId_fkey" FOREIGN KEY ("cashMovementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- spec v3 · Backfill de pagos históricos: convertir los movimientos de
-- Purchase.paidPartsMovementId / paidFreightMovementId en filas de
-- PurchasePayment. Los campos denormalizados de Purchase quedan como
-- resumen (fecha del último pago).
INSERT INTO "PurchasePayment" ("id", "purchaseId", "kind", "amount", "cashMovementId", "paidAt", "createdAt")
SELECT gen_random_uuid(), p."id", 'PARTS', p."amount", p."paidPartsMovementId", p."paidPartsAt", COALESCE(p."paidPartsAt", NOW())
FROM "Purchase" p
WHERE p."paidPartsMovementId" IS NOT NULL;

INSERT INTO "PurchasePayment" ("id", "purchaseId", "kind", "amount", "cashMovementId", "paidAt", "createdAt")
SELECT gen_random_uuid(), p."id", 'FREIGHT', p."freightAmount", p."paidFreightMovementId", p."paidFreightAt", COALESCE(p."paidFreightAt", NOW())
FROM "Purchase" p
WHERE p."paidFreightMovementId" IS NOT NULL;
