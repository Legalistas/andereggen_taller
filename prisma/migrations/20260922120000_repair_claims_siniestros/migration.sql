-- DropIndex
DROP INDEX "Repair_internalNumber_key";

-- CreateTable
CREATE TABLE "RepairClaim" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "claimNumber" TEXT,
    "budgetId" TEXT,
    "approvedLabor" DECIMAL(14,2),
    "approvedParts" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RepairClaim_budgetId_key" ON "RepairClaim"("budgetId");

-- CreateIndex
CREATE INDEX "RepairClaim_repairId_idx" ON "RepairClaim"("repairId");

-- CreateIndex
CREATE INDEX "Repair_internalNumber_idx" ON "Repair"("internalNumber");

-- AddForeignKey
ALTER TABLE "RepairClaim" ADD CONSTRAINT "RepairClaim_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairClaim" ADD CONSTRAINT "RepairClaim_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- Backfill: cada reparación existente que ya tenía presupuesto o importe
-- aprobado pasa a tener su "Siniestro 1", para que las tarjetas viejas se
-- vean igual que antes con el modelo nuevo.
--
-- El importe aprobado por el seguro se vuelca entero en mano de obra porque
-- el desglose mano de obra / repuestos no existía: el total no cambia y el
-- taller puede re-repartirlo a mano desde la ficha.
-- ─────────────────────────────────────────────────────────────
INSERT INTO "RepairClaim" (
  "id", "repairId", "order", "budgetId", "approvedLabor", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  r."id",
  1,
  r."budgetId",
  r."approvedInsurance",
  NOW(),
  NOW()
FROM "Repair" r
WHERE r."budgetId" IS NOT NULL OR r."approvedInsurance" IS NOT NULL;
