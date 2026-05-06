-- AlterTable: Nº interno del taller (correlativo único, asignado al crear Repair)
ALTER TABLE "Repair" ADD COLUMN "internalNumber" INTEGER;

-- CreateIndex: unique para que dos Repairs no puedan compartir Nº
CREATE UNIQUE INDEX "Repair_internalNumber_key" ON "Repair"("internalNumber");
