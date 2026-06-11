-- Bucket de la grilla comparativa para Administrativa:
-- OFICIAL = concesionaria oficial
-- ALTERNATIVO = repuesto alternativo
-- DESARMADERO = repuesto usado

CREATE TYPE "QuoteCategory" AS ENUM ('OFICIAL', 'ALTERNATIVO', 'DESARMADERO');

ALTER TABLE "BudgetAdminQuote"
  ADD COLUMN "category" "QuoteCategory" NOT NULL DEFAULT 'OFICIAL';

CREATE INDEX "BudgetAdminQuote_itemId_category_idx"
  ON "BudgetAdminQuote"("itemId", "category");
