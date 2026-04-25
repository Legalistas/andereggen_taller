-- Quita la columna "Ingresado" del Kanban de Producción.
-- Migra todas las reparaciones que hoy están en 'ingresado' a 'chapa', y
-- setea enteredAt si no lo tenía (usa updatedAt como fallback).
--
-- El valor 'ingresado' del enum RepairStatus NO se elimina (Postgres
-- no permite remover valores de un enum sin recrear el tipo). Queda
-- como deprecated; ningún código nuevo lo usa.
UPDATE "Repair"
SET status = 'chapa',
    "enteredAt" = COALESCE("enteredAt", "updatedAt")
WHERE status = 'ingresado';
