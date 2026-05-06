-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "insuranceCoverageType" TEXT,
ADD COLUMN     "insuranceFranchise" DECIMAL(14,2),
ADD COLUMN     "vehicleChassis" TEXT;

-- AlterTable
ALTER TABLE "CustomerVehicle" ADD COLUMN     "chassis" TEXT,
ADD COLUMN     "coverageType" TEXT,
ADD COLUMN     "franchise" DECIMAL(14,2);
