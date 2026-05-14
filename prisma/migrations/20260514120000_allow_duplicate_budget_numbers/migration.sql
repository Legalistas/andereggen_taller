-- Permitir repetir el número de presupuesto manualmente.
-- Antes: par (number, extensionSuffix) era único. Ahora `number` es libre.
-- La identidad real es `id`; el par sigue siendo coherente para ampliaciones
-- de un mismo padre porque la unicidad efectiva se enforcea por código
-- (nextExtensionSuffix mira parentBudgetId, no number).

DROP INDEX IF EXISTS "Budget_number_extensionSuffix_key";

-- Índice no único para mantener performance de búsquedas/orden por número.
CREATE INDEX IF NOT EXISTS "Budget_number_idx" ON "Budget"("number");
