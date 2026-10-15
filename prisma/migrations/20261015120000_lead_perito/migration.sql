-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "peritoId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_peritoId_idx" ON "Lead"("peritoId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_peritoId_fkey" FOREIGN KEY ("peritoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

