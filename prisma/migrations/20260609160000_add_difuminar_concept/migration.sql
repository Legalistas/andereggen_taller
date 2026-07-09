-- Nueva categoría descriptiva "Difuminar" en el armado de presupuestos.
-- Se agrega después de DESABOLLAR (mismo tipo: DESCRIPTIVO, sin importe).

ALTER TYPE "ConceptCategory" ADD VALUE IF NOT EXISTS 'DIFUMINAR';
