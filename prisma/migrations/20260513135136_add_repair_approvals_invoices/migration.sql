-- CreateEnum
CREATE TYPE "InvoiceRecipient" AS ENUM ('CLIENTE', 'SEGURO', 'OTRO');

-- AlterTable
ALTER TABLE "Repair" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedCustomer" DECIMAL(14,2),
ADD COLUMN     "approvedFranchise" DECIMAL(14,2),
ADD COLUMN     "approvedInsurance" DECIMAL(14,2),
ADD COLUMN     "approvedNotes" TEXT,
ADD COLUMN     "insuranceCompany" TEXT;

-- CreateTable
CREATE TABLE "RepairInvoice" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "recipient" "InvoiceRecipient" NOT NULL DEFAULT 'CLIENTE',
    "recipientName" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairInvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod" NOT NULL DEFAULT 'EFECTIVO',
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairInvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepairInvoice_repairId_idx" ON "RepairInvoice"("repairId");

-- CreateIndex
CREATE INDEX "RepairInvoice_issuedAt_idx" ON "RepairInvoice"("issuedAt");

-- CreateIndex
CREATE INDEX "RepairInvoicePayment_invoiceId_idx" ON "RepairInvoicePayment"("invoiceId");

-- CreateIndex
CREATE INDEX "RepairInvoicePayment_paidAt_idx" ON "RepairInvoicePayment"("paidAt");

-- AddForeignKey
ALTER TABLE "RepairInvoice" ADD CONSTRAINT "RepairInvoice_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairInvoice" ADD CONSTRAINT "RepairInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairInvoicePayment" ADD CONSTRAINT "RepairInvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "RepairInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairInvoicePayment" ADD CONSTRAINT "RepairInvoicePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
