-- spec Tarjetas oct '26 · Compras con tarjeta de crédito en cuotas
-- (Requerimientos, sección M, puntos 50 y 51). Tres tablas nuevas: las
-- tarjetas, las compras y sus cuotas. Una cuota queda pagada cuando apunta
-- al EGRESO de caja que pagó su resumen. Solo agrega: no toca nada existente.

-- CreateTable
CREATE TABLE "CreditCard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPurchase" (
    "id" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "concept" TEXT NOT NULL,
    "supplier" TEXT,
    "notes" TEXT,
    "reference" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardInstallment" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "movementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardPurchase_creditCardId_idx" ON "CardPurchase"("creditCardId");

-- CreateIndex
CREATE INDEX "CardPurchase_purchasedAt_idx" ON "CardPurchase"("purchasedAt");

-- CreateIndex
CREATE INDEX "CardInstallment_creditCardId_period_idx" ON "CardInstallment"("creditCardId", "period");

-- CreateIndex
CREATE INDEX "CardInstallment_purchaseId_idx" ON "CardInstallment"("purchaseId");

-- CreateIndex
CREATE INDEX "CardInstallment_movementId_idx" ON "CardInstallment"("movementId");

-- AddForeignKey
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardInstallment" ADD CONSTRAINT "CardInstallment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CardPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardInstallment" ADD CONSTRAINT "CardInstallment_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardInstallment" ADD CONSTRAINT "CardInstallment_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
