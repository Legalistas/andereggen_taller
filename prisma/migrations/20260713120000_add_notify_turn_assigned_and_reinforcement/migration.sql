-- spec 2.1 v2 · Flag para mail automático al asignar turno.
-- spec 1.3 v2 · Flag para mail automático al pasar lead a "Refuerzo".
ALTER TABLE "AppSettings"
  ADD COLUMN "notifyTurnAssigned"       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyLeadReinforcement"  BOOLEAN NOT NULL DEFAULT true;
