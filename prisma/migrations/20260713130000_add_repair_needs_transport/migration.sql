-- spec 2.3 v2 · Checkbox de traslado del cliente en el calendario/turno.
ALTER TABLE "Repair"
  ADD COLUMN "needsTransport" BOOLEAN NOT NULL DEFAULT false;
