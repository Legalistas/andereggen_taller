-- spec 2.1 v2 · Nueva columna "Turno a Asignar" (previa a "Turno Asignado")
-- para leads ganados sin turno coordinado todavía.
ALTER TYPE "RepairStatus" ADD VALUE 'turno_a_asignar';
