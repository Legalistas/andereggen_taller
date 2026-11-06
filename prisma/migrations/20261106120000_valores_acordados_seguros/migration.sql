-- Valores acordados con las aseguradoras para todo riesgo (finales, con IVA):
-- el presupuesto los propone en Pintura (por paño) y Chapa (por día).

-- AlterTable
ALTER TABLE "InsuranceCompany" ADD COLUMN     "paintPanelPrice" DECIMAL(14,2),
ADD COLUMN     "sheetDayPrice" DECIMAL(14,2);


-- Lo acordado hoy con El Norte y Sancor; se cambia en Configuración → Seguros.
UPDATE "InsuranceCompany" SET "paintPanelPrice" = 250000, "sheetDayPrice" = 280000
WHERE lower("name") LIKE '%el norte%';
UPDATE "InsuranceCompany" SET "paintPanelPrice" = 242000, "sheetDayPrice" = 242000
WHERE lower("name") LIKE '%sancor%';
