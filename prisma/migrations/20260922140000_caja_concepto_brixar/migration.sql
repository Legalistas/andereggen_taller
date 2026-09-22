-- Caja · El rubro de egresos "Inversiones construcción" pasa a llamarse
-- "Brixar" (es la misma obra, y el catálogo ya tenía "Brixar" cargado como
-- concepto aparte: quedaban dos líneas para lo mismo en el resumen mensual).
--
-- Los movimientos ya cargados se renombran para que el total del mes salga
-- en una sola línea. No cambia ningún importe ni ninguna caja.
UPDATE "CashMovement"
SET concept = 'Brixar'
WHERE concept = 'Inversiones construcción';

-- Normalización de mayúsculas del mismo concepto cargado a mano. No se tocan
-- los que tienen descripción propia (ej. "BRIXAR - AGUSTIN"): ahí el texto
-- extra es información que el taller quiso dejar asentada.
UPDATE "CashMovement"
SET concept = 'Brixar'
WHERE concept = 'brixar';
