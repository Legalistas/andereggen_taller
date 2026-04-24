-- CreateEnum
CREATE TYPE "ToolCategory" AS ENUM ('NEUMATICA', 'HIDRAULICA', 'ELECTRICA', 'MANUAL', 'ELEVACION', 'SOLDADURA', 'PINTURA', 'DIAGNOSTICO', 'OTROS');

-- CreateEnum
CREATE TYPE "ToolStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED');

-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "category" "ToolCategory" NOT NULL DEFAULT 'OTROS',
    "status" "ToolStatus" NOT NULL DEFAULT 'AVAILABLE',
    "assignedToId" TEXT,
    "location" TEXT,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "acquiredAt" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tool_code_key" ON "Tool"("code");

-- CreateIndex
CREATE INDEX "Tool_status_idx" ON "Tool"("status");

-- CreateIndex
CREATE INDEX "Tool_category_idx" ON "Tool"("category");

-- CreateIndex
CREATE INDEX "Tool_assignedToId_idx" ON "Tool"("assignedToId");

-- CreateIndex
CREATE INDEX "Tool_isActive_idx" ON "Tool"("isActive");

-- AddForeignKey
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
