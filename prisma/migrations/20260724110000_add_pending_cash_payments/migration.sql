-- spec v2 · Pagos preparados / para realizar.

-- CreateEnum
CREATE TYPE "PendingCashPaymentStatus" AS ENUM ('PENDIENTE', 'PAGADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "PendingCashPayment" (
    "id" TEXT NOT NULL,
    "cashBoxId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'EFECTIVO',
    "concept" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "PendingCashPaymentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "paidAt" TIMESTAMP(3),
    "paidByMovementId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingCashPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingCashPayment_paidByMovementId_key" ON "PendingCashPayment"("paidByMovementId");
CREATE INDEX "PendingCashPayment_cashBoxId_idx" ON "PendingCashPayment"("cashBoxId");
CREATE INDEX "PendingCashPayment_status_idx" ON "PendingCashPayment"("status");
CREATE INDEX "PendingCashPayment_dueDate_idx" ON "PendingCashPayment"("dueDate");

-- AddForeignKey
ALTER TABLE "PendingCashPayment" ADD CONSTRAINT "PendingCashPayment_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PendingCashPayment" ADD CONSTRAINT "PendingCashPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
