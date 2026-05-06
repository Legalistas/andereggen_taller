-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "partsNote" TEXT,
ADD COLUMN     "vehiclePerladoTricapa" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CustomerVehicle" ADD COLUMN     "perladoTricapa" BOOLEAN NOT NULL DEFAULT false;
