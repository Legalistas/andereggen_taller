-- spec sección 4 v2 · Módulo Caja
-- Trazabilidad del dinero entre las 5 cajas administradas por Ayelén.

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('INGRESO', 'EGRESO', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateTable
CREATE TABLE "CashBox" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "cashBoxId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'EFECTIVO',
    "concept" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "transferGroupId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "RepairInvoicePayment" ADD COLUMN "cashBoxId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CashBox_key_key" ON "CashBox"("key");
CREATE INDEX "CashBox_sortOrder_idx" ON "CashBox"("sortOrder");
CREATE INDEX "CashMovement_cashBoxId_idx" ON "CashMovement"("cashBoxId");
CREATE INDEX "CashMovement_paidAt_idx" ON "CashMovement"("paidAt");
CREATE INDEX "CashMovement_transferGroupId_idx" ON "CashMovement"("transferGroupId");
CREATE INDEX "RepairInvoicePayment_cashBoxId_idx" ON "RepairInvoicePayment"("cashBoxId");

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RepairInvoicePayment" ADD CONSTRAINT "RepairInvoicePayment_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed de las 5 cajas — spec 4.3
INSERT INTO "CashBox" ("id", "key", "name", "description", "sortOrder", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'caja_1',       'Caja 1',       'Facturación oficial (Oscar / Alfredo).', 10, NOW(), NOW()),
  (gen_random_uuid(), 'caja_2',       'Caja 2',       'Taller — efectivo interno (la "línea negra").', 20, NOW(), NOW()),
  (gen_random_uuid(), 'caja_maria',   'Caja María',   'Fondos asignados a María.', 30, NOW(), NOW()),
  (gen_random_uuid(), 'caja_alfredo', 'Caja Alfredo', 'Fondos asignados a Alfredo.', 40, NOW(), NOW()),
  (gen_random_uuid(), 'caja_lucila',  'Caja Lucila',  'Fondos asignados a Lucila.', 50, NOW(), NOW());
