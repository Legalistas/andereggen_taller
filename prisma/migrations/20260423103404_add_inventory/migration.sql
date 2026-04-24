-- CreateEnum
CREATE TYPE "PartCategory" AS ENUM ('CARROCERIA', 'CRISTALERIA', 'MECANICA', 'ELECTRICO', 'PINTURA', 'FRENOS', 'SUSPENSION', 'FILTROS', 'ILUMINACION', 'INTERIOR', 'OTROS');

-- CreateEnum
CREATE TYPE "PartMovementType" AS ENUM ('IN', 'OUT', 'ADJUST');

-- AlterTable
ALTER TABLE "BudgetPart" ADD COLUMN     "partId" TEXT;

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "appliesTo" TEXT,
    "category" "PartCategory" NOT NULL DEFAULT 'OTROS',
    "costPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stockQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stockMin" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartMovement" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "type" "PartMovementType" NOT NULL,
    "qty" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "budgetId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Part_sku_key" ON "Part"("sku");

-- CreateIndex
CREATE INDEX "Part_category_idx" ON "Part"("category");

-- CreateIndex
CREATE INDEX "Part_isActive_idx" ON "Part"("isActive");

-- CreateIndex
CREATE INDEX "Part_name_idx" ON "Part"("name");

-- CreateIndex
CREATE INDEX "PartMovement_partId_idx" ON "PartMovement"("partId");

-- CreateIndex
CREATE INDEX "PartMovement_type_idx" ON "PartMovement"("type");

-- CreateIndex
CREATE INDEX "PartMovement_budgetId_idx" ON "PartMovement"("budgetId");

-- CreateIndex
CREATE INDEX "PartMovement_createdById_idx" ON "PartMovement"("createdById");

-- CreateIndex
CREATE INDEX "PartMovement_createdAt_idx" ON "PartMovement"("createdAt");

-- CreateIndex
CREATE INDEX "BudgetPart_partId_idx" ON "BudgetPart"("partId");

-- AddForeignKey
ALTER TABLE "BudgetPart" ADD CONSTRAINT "BudgetPart_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartMovement" ADD CONSTRAINT "PartMovement_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartMovement" ADD CONSTRAINT "PartMovement_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartMovement" ADD CONSTRAINT "PartMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
