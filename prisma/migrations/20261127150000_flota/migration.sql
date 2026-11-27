-- CreateEnum
CREATE TYPE "FleetObligationType" AS ENUM ('SEGURO', 'PATENTE', 'VTV', 'OTRO');

-- CreateEnum
CREATE TYPE "FleetMaintenanceKind" AS ENUM ('SERVICE', 'REPARACION', 'REPUESTO');

-- CreateTable
CREATE TABLE "FleetVehicle" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "color" TEXT,
    "chassisNumber" TEXT,
    "engineNumber" TEXT,
    "ownerName" TEXT,
    "transferred" BOOLEAN NOT NULL DEFAULT false,
    "documentsLocation" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetObligation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "FleetObligationType" NOT NULL,
    "provider" TEXT,
    "reference" TEXT,
    "holderName" TEXT,
    "autoDebit" BOOLEAN NOT NULL DEFAULT false,
    "debitAccount" TEXT,
    "periodMonths" INTEGER,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetPayment" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetMaintenance" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" "FleetMaintenanceKind" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mileage" INTEGER,
    "description" TEXT NOT NULL,
    "provider" TEXT,
    "cost" DECIMAL(14,2),
    "nextDate" TIMESTAMP(3),
    "nextMileage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetFile" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "paymentId" TEXT,
    "maintenanceId" TEXT,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FleetFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FleetVehicle_plate_key" ON "FleetVehicle"("plate");

-- CreateIndex
CREATE INDEX "FleetVehicle_isActive_idx" ON "FleetVehicle"("isActive");

-- CreateIndex
CREATE INDEX "FleetObligation_vehicleId_idx" ON "FleetObligation"("vehicleId");

-- CreateIndex
CREATE INDEX "FleetObligation_validUntil_idx" ON "FleetObligation"("validUntil");

-- CreateIndex
CREATE INDEX "FleetPayment_obligationId_idx" ON "FleetPayment"("obligationId");

-- CreateIndex
CREATE INDEX "FleetPayment_paidAt_dueDate_idx" ON "FleetPayment"("paidAt", "dueDate");

-- CreateIndex
CREATE INDEX "FleetMaintenance_vehicleId_date_idx" ON "FleetMaintenance"("vehicleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FleetFile_storageKey_key" ON "FleetFile"("storageKey");

-- CreateIndex
CREATE INDEX "FleetFile_vehicleId_idx" ON "FleetFile"("vehicleId");

-- CreateIndex
CREATE INDEX "FleetFile_paymentId_idx" ON "FleetFile"("paymentId");

-- CreateIndex
CREATE INDEX "FleetFile_maintenanceId_idx" ON "FleetFile"("maintenanceId");

-- AddForeignKey
ALTER TABLE "FleetObligation" ADD CONSTRAINT "FleetObligation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetPayment" ADD CONSTRAINT "FleetPayment_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "FleetObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetMaintenance" ADD CONSTRAINT "FleetMaintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetFile" ADD CONSTRAINT "FleetFile_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetFile" ADD CONSTRAINT "FleetFile_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FleetPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetFile" ADD CONSTRAINT "FleetFile_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "FleetMaintenance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

