-- spec Tarjetas oct '26 · Día de cierre y de vencimiento de cada tarjeta, y
-- vencimiento de cada cuota (mismo funcionamiento que en Legalistas).
--
-- Va aparte porque la migración 20261013120000_tarjetas_cuotas ya se había
-- aplicado en producción en su primera versión, sin estas columnas, y Prisma
-- no vuelve a correr una migración aplicada. Con IF NOT EXISTS, así no falla
-- en ninguna base, tenga o no las columnas. Solo agrega.

-- AlterTable
ALTER TABLE "CreditCard" ADD COLUMN IF NOT EXISTS "closingDay" INTEGER;
ALTER TABLE "CreditCard" ADD COLUMN IF NOT EXISTS "dueDay" INTEGER;

-- AlterTable
ALTER TABLE "CardInstallment" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);

-- Si hubiera cuotas cargadas sin vencimiento: el 10 del mes siguiente a su
-- resumen, que es la regla para una tarjeta sin días cargados.
UPDATE "CardInstallment"
SET "dueDate" = to_date("period" || '-10', 'YYYY-MM-DD') + INTERVAL '1 month'
WHERE "dueDate" IS NULL;

ALTER TABLE "CardInstallment" ALTER COLUMN "dueDate" SET NOT NULL;
