-- spec Compras v2 · Nuevo módulo de Compras con máquina de estados,
-- catálogo de proveedores único (repuestos + fletes) y links bidireccionales
-- con CashMovement para pagos separados de repuesto/flete.

-- ─── Enum PurchaseStatus ─────────────────────────────────────────────
CREATE TYPE "PurchaseStatus" AS ENUM (
  'COTIZAR',
  'DECIDIR',
  'COMPRAR',
  'EN_CAMINO',
  'EN_TALLER',
  'PENDIENTE_PAGO',
  'ARCHIVADA'
);

-- ─── Supplier ────────────────────────────────────────────────────────
CREATE TABLE "Supplier" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "phone"     TEXT,
  "email"     TEXT,
  "address"   TEXT,
  "notes"     TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

-- ─── BudgetAdminQuote · agregar supplierId (nullable) ────────────────
ALTER TABLE "BudgetAdminQuote" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "BudgetAdminQuote"
  ADD CONSTRAINT "BudgetAdminQuote_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "BudgetAdminQuote_supplierId_idx" ON "BudgetAdminQuote"("supplierId");

-- ─── Purchase ────────────────────────────────────────────────────────
CREATE TABLE "Purchase" (
  "id"                    TEXT NOT NULL,
  "itemId"                TEXT NOT NULL,
  "number"                TEXT NOT NULL,
  "status"                "PurchaseStatus" NOT NULL DEFAULT 'COTIZAR',
  "chosenQuoteId"         TEXT,
  "category"              "QuoteCategory",
  "supplierId"            TEXT,
  "supplierName"          TEXT,
  "amount"                DECIMAL(14,2) NOT NULL DEFAULT 0,
  "freightAmount"         DECIMAL(14,2) NOT NULL DEFAULT 0,
  "freightSupplierId"     TEXT,
  "freightSupplierName"   TEXT,
  "purchasedAt"           TIMESTAMP(3),
  "receivedAt"            TIMESTAMP(3),
  "archivedAt"            TIMESTAMP(3),
  "paidPartsAt"           TIMESTAMP(3),
  "paidPartsMovementId"   TEXT,
  "paidFreightAt"         TIMESTAMP(3),
  "paidFreightMovementId" TEXT,
  "receiptUrl"            TEXT,
  "notes"                 TEXT,
  "createdById"           TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Purchase_number_key" ON "Purchase"("number");
CREATE UNIQUE INDEX "Purchase_paidPartsMovementId_key"   ON "Purchase"("paidPartsMovementId");
CREATE UNIQUE INDEX "Purchase_paidFreightMovementId_key" ON "Purchase"("paidFreightMovementId");
CREATE INDEX "Purchase_itemId_idx"            ON "Purchase"("itemId");
CREATE INDEX "Purchase_status_idx"            ON "Purchase"("status");
CREATE INDEX "Purchase_supplierId_idx"        ON "Purchase"("supplierId");
CREATE INDEX "Purchase_freightSupplierId_idx" ON "Purchase"("freightSupplierId");
CREATE INDEX "Purchase_purchasedAt_idx"       ON "Purchase"("purchasedAt");

ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "BudgetAdminItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_chosenQuoteId_fkey"
    FOREIGN KEY ("chosenQuoteId") REFERENCES "BudgetAdminQuote"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_freightSupplierId_fkey"
    FOREIGN KEY ("freightSupplierId") REFERENCES "Supplier"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_paidPartsMovementId_fkey"
    FOREIGN KEY ("paidPartsMovementId") REFERENCES "CashMovement"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_paidFreightMovementId_fkey"
    FOREIGN KEY ("paidFreightMovementId") REFERENCES "CashMovement"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Backfill: migrar BudgetAdminPurchase existentes a Purchase ARCHIVADA ─
-- El brief pide historial; los que ya estaban registrados los pasamos como
-- ARCHIVADA para que no aparezcan en las tabs activas del kanban, pero
-- queden accesibles desde la vista de detalle del ítem. `number` = id del
-- BudgetAdminPurchase (fallback) porque no tenemos secuencia histórica.
INSERT INTO "Purchase" (
  "id", "itemId", "number", "status", "supplierName", "amount",
  "purchasedAt", "notes", "receiptUrl", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  "itemId",
  'legacy-' || "id",
  'ARCHIVADA',
  "supplierName",
  "amount",
  "purchasedAt",
  COALESCE("notes", '') || CASE WHEN "notes" IS NOT NULL THEN E'\n\n' ELSE '' END
    || '(migrado del sistema anterior · id legacy: ' || "id" || ')',
  "receiptUrl",
  "createdAt",
  "updatedAt"
FROM "BudgetAdminPurchase";

-- ─── Drop tabla vieja ─────────────────────────────────────────────────
DROP TABLE "BudgetAdminPurchase";
