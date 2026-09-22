-- AlterTable
ALTER TABLE "Repair" ADD COLUMN     "isUrgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "urgencyNote" TEXT;

