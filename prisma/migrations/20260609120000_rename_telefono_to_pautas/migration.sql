-- Renombrar la fuente de lead "Teléfono" → "Pautas".
-- Actualiza la fila del catálogo y reasigna los leads que ya tenían
-- source='telefono' al nuevo key.

UPDATE "LeadSource"
SET "key" = 'pautas', "label" = 'Pautas'
WHERE "key" = 'telefono';

UPDATE "Lead"
SET "source" = 'pautas'
WHERE "source" = 'telefono';
