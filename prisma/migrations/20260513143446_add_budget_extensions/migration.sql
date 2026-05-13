/*
  Warnings:

  - A unique constraint covering the columns `[number,extensionSuffix]` on the table `Budget` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ExtensionPayer" AS ENUM ('SEGURO', 'FRANQUICIA', 'PARTICULAR');

-- DropIndex
DROP INDEX "Budget_number_key";

-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "extensionPayer" "ExtensionPayer",
ADD COLUMN     "extensionSuffix" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parentBudgetId" TEXT;

-- CreateIndex
CREATE INDEX "Budget_parentBudgetId_idx" ON "Budget"("parentBudgetId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_number_extensionSuffix_key" ON "Budget"("number", "extensionSuffix");

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_parentBudgetId_fkey" FOREIGN KEY ("parentBudgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
