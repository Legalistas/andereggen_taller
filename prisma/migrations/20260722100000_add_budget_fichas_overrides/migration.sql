-- spec v2 · Persistir ediciones del dialog "Fichas" (Ficha Técnica +
-- Ficha Ingreso/Egreso). Antes se descartaban al cerrar el modal.
ALTER TABLE "Budget" ADD COLUMN "fichasOverrides" JSONB;
