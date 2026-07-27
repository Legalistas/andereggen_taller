-- spec v2 · Fix histórico de TZ en Caja.
-- Antes, MovementDialog/TransferDialog mandaban el `YYYY-MM-DD` crudo al server,
-- que lo parseaba con `new Date("YYYY-MM-DD")` → UTC medianoche → en AR (UTC-3)
-- se mostraba un día antes. Corremos +12h a los movimientos y cobros con hora
-- exactamente 00:00:00 UTC (síntoma del bug) para que caigan al mediodía local
-- del día que el operador realmente eligió.

-- CashMovement — ingresos, egresos, transferencias manuales
UPDATE "CashMovement"
   SET "paidAt" = "paidAt" + INTERVAL '12 hours'
 WHERE EXTRACT(HOUR   FROM ("paidAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(MINUTE FROM ("paidAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(SECOND FROM ("paidAt" AT TIME ZONE 'UTC')) = 0;

-- RepairInvoicePayment — cobros vinculados a facturas de repair
UPDATE "RepairInvoicePayment"
   SET "paidAt" = "paidAt" + INTERVAL '12 hours'
 WHERE EXTRACT(HOUR   FROM ("paidAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(MINUTE FROM ("paidAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(SECOND FROM ("paidAt" AT TIME ZONE 'UTC')) = 0;
