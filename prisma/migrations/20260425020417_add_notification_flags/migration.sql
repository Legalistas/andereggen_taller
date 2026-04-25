-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "notifyBudgetCreated" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyCustomerExperience" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPartsReceived" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyRepairCompleted" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyVehicleEntered" BOOLEAN NOT NULL DEFAULT true;
