-- Renombra el valor del enum RepairStatus: repuestos_recibidos → pendientes_repuestos.
-- Mantiene el orden y todos los registros existentes preservan su estado (Postgres
-- traduce el valor automáticamente al renombrarse).
ALTER TYPE "RepairStatus" RENAME VALUE 'repuestos_recibidos' TO 'pendientes_repuestos';

-- Agrega el nuevo valor 'pendientes_cobro' al enum LeadStatus, ubicado antes de 'ganado'.
-- Postgres mantiene el orden de declaración, importante para queries que ordenan por estado.
ALTER TYPE "LeadStatus" ADD VALUE 'pendientes_cobro' BEFORE 'ganado';
