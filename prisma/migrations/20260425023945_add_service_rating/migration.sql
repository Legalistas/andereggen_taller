-- CreateTable
CREATE TABLE "ServiceRating" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "stars" INTEGER,
    "comment" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRating_repairId_key" ON "ServiceRating"("repairId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRating_token_key" ON "ServiceRating"("token");

-- CreateIndex
CREATE INDEX "ServiceRating_token_idx" ON "ServiceRating"("token");

-- CreateIndex
CREATE INDEX "ServiceRating_respondedAt_idx" ON "ServiceRating"("respondedAt");

-- AddForeignKey
ALTER TABLE "ServiceRating" ADD CONSTRAINT "ServiceRating_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
