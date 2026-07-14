-- CreateEnum
CREATE TYPE "InsuranceResponsibility" AS ENUM ('propio', 'tercero', 'particular');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "insuranceResponsibility" "InsuranceResponsibility",
ADD COLUMN     "orderReceivedAt" TIMESTAMP(3);

-- Backfill: leads ya ganados no tienen orderReceivedAt; los imputamos a su
-- updatedAt (aproximación al momento en que pasaron a "ganado"). Nuevos leads
-- se setean explícitamente al cambiar de estado.
UPDATE "Lead"
   SET "orderReceivedAt" = "updatedAt"
 WHERE "status" = 'ganado'
   AND "orderReceivedAt" IS NULL;

-- CreateIndex
CREATE INDEX "Lead_orderReceivedAt_idx" ON "Lead"("orderReceivedAt");
