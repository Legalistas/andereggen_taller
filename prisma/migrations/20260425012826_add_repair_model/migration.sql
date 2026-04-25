-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('turno_asignado', 'ingresado', 'repuestos_recibidos', 'chapa', 'pintura', 'calidad', 'experiencia_cliente', 'archivado');

-- CreateTable
CREATE TABLE "Repair" (
    "id" TEXT NOT NULL,
    "status" "RepairStatus" NOT NULL DEFAULT 'turno_asignado',
    "leadId" TEXT,
    "budgetId" TEXT,
    "directCreation" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT,
    "vehicleId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "vehicleBrand" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "vehicleYear" TEXT NOT NULL,
    "vehicleDomain" TEXT NOT NULL,
    "reason" TEXT,
    "assignedMechanicId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "enteredAt" TIMESTAMP(3),
    "partsReceivedAt" TIMESTAMP(3),
    "estimatedDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Repair_budgetId_key" ON "Repair"("budgetId");

-- CreateIndex
CREATE INDEX "Repair_status_idx" ON "Repair"("status");

-- CreateIndex
CREATE INDEX "Repair_leadId_idx" ON "Repair"("leadId");

-- CreateIndex
CREATE INDEX "Repair_assignedMechanicId_idx" ON "Repair"("assignedMechanicId");

-- CreateIndex
CREATE INDEX "Repair_archivedAt_idx" ON "Repair"("archivedAt");

-- CreateIndex
CREATE INDEX "Repair_customerId_idx" ON "Repair"("customerId");

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "CustomerVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_assignedMechanicId_fkey" FOREIGN KEY ("assignedMechanicId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
