-- CreateTable
CREATE TABLE "CashConcept" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashConcept_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashConcept_parentId_idx" ON "CashConcept"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "CashConcept_parentId_label_key" ON "CashConcept"("parentId", "label");

-- AddForeignKey
ALTER TABLE "CashConcept" ADD CONSTRAINT "CashConcept_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CashConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed: la lista que hasta ahora vivía fija en el código, en el mismo orden,
-- más las subcategorías de Impuestos.
INSERT INTO "CashConcept" ("id", "label", "parentId", "order", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, l, NULL, (o * 10), true, NOW(), NOW()
FROM unnest(ARRAY[
  'Sueldos','Flete','Aportes entidades','Gastos administrativos','Publicidad',
  'Repuestos','Albañiles','Particular','Varios','Mano de obra tercerizada',
  'Mejoras de edificio','Impuestos','AP seguros','Gastos jefes de obras',
  'Alquileres','Marketing','Brixar'
]) WITH ORDINALITY AS t(l, o);

INSERT INTO "CashConcept" ("id", "label", "parentId", "order", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s, p.id, (o * 10), true, NOW(), NOW()
FROM unnest(ARRAY[
  'Luz','Agua','Gas','TGI','API inmobiliario','Seguros AP','Seguros vehículos','Patentes'
]) WITH ORDINALITY AS t(s, o)
JOIN "CashConcept" p ON p.label = 'Impuestos' AND p."parentId" IS NULL;
