-- Localidad del cliente al momento de emitir el presupuesto.
-- Snapshot inmutable, mismo patrón que customerAddress/customerDni.
ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "customerCity" TEXT;
