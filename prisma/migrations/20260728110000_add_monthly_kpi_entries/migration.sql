-- spec KPIs jul '26 · Valores MANUALES del tablero de KPIs (por ahora
-- solo "reclamos" del mes, pero queda genérico para futuros manuales).

-- CreateTable
CREATE TABLE "MonthlyKpiEntry" (
    "id" TEXT NOT NULL,
    "metricKey" VARCHAR(80) NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyKpiEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyKpiEntry_metricKey_year_month_key" ON "MonthlyKpiEntry"("metricKey", "year", "month");
CREATE INDEX "MonthlyKpiEntry_metricKey_idx" ON "MonthlyKpiEntry"("metricKey");
CREATE INDEX "MonthlyKpiEntry_year_month_idx" ON "MonthlyKpiEntry"("year", "month");

-- AddForeignKey
ALTER TABLE "MonthlyKpiEntry" ADD CONSTRAINT "MonthlyKpiEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
