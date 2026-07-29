-- spec v2 · Fix histórico TZ (v2): PaymentsList del repair-canvas seguía
-- mandando `new Date("YYYY-MM-DD").toISOString()` (UTC midnight) hasta este
-- parche. Corremos +12h a los pagos con hora exactamente 00:00 UTC para
-- que caigan al mediodía local del día que el operador realmente eligió.
--
-- Idempotente: si el pago ya tiene hora distinta a 00:00 no lo tocamos.

UPDATE "RepairInvoicePayment"
   SET "paidAt" = "paidAt" + INTERVAL '12 hours'
 WHERE EXTRACT(HOUR   FROM ("paidAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(MINUTE FROM ("paidAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(SECOND FROM ("paidAt" AT TIME ZONE 'UTC')) = 0;
