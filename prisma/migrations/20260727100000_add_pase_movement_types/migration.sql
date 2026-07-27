-- spec v2 · Nuevos tipos de movimiento "PASE" — dinero que entra/sale de
-- la caja sin ser ingreso/egreso contable (retiros temporales, etc.).
ALTER TYPE "CashMovementType" ADD VALUE 'PASE_IN';
ALTER TYPE "CashMovementType" ADD VALUE 'PASE_OUT';
