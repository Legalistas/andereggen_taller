-- CreateTable
CREATE TABLE "BudgetAdminItem" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "photos" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetAdminItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetAdminQuote" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetAdminQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetAdminPurchase" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetAdminPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetAdminItem_budgetId_idx" ON "BudgetAdminItem"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetAdminQuote_itemId_idx" ON "BudgetAdminQuote"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetAdminPurchase_itemId_key" ON "BudgetAdminPurchase"("itemId");

-- AddForeignKey
ALTER TABLE "BudgetAdminItem" ADD CONSTRAINT "BudgetAdminItem_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAdminQuote" ADD CONSTRAINT "BudgetAdminQuote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BudgetAdminItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAdminPurchase" ADD CONSTRAINT "BudgetAdminPurchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BudgetAdminItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
