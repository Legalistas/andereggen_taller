-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "inspectorId" TEXT,
ADD COLUMN     "insuranceAgentId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_inspectorId_idx" ON "Lead"("inspectorId");

-- CreateIndex
CREATE INDEX "Lead_insuranceAgentId_idx" ON "Lead"("insuranceAgentId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_insuranceAgentId_fkey" FOREIGN KEY ("insuranceAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
