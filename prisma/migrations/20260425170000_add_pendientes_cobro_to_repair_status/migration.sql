-- Agrega 'pendientes_cobro' al enum RepairStatus, ubicado antes de 'archivado'.
-- Etapa entre experiencia_cliente y archivado: trabajo terminado, falta cobrar.
ALTER TYPE "RepairStatus" ADD VALUE 'pendientes_cobro' BEFORE 'archivado';
