-- spec 2.3 v2 · Fix histórico de TZ.
-- Antes, `DateField` usaba `new Date("YYYY-MM-DD").toISOString()` que
-- interpreta como UTC medianoche → en AR (UTC-3) se muestra un día antes.
-- Todos los registros con hora exactamente 00:00 UTC fueron generados por
-- ese bug. Los shifteamos +12h para que caigan al mediodía local del día
-- que el usuario realmente eligió (elimina falsos domingos, y deja horarios
-- razonables cuando el equipo abra el modal a corregir).

UPDATE "Repair"
   SET "scheduledAt" = "scheduledAt" + INTERVAL '12 hours'
 WHERE "scheduledAt" IS NOT NULL
   AND EXTRACT(HOUR FROM ("scheduledAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(MINUTE FROM ("scheduledAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(SECOND FROM ("scheduledAt" AT TIME ZONE 'UTC')) = 0;

UPDATE "Repair"
   SET "estimatedDeliveryAt" = "estimatedDeliveryAt" + INTERVAL '12 hours'
 WHERE "estimatedDeliveryAt" IS NOT NULL
   AND EXTRACT(HOUR FROM ("estimatedDeliveryAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(MINUTE FROM ("estimatedDeliveryAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(SECOND FROM ("estimatedDeliveryAt" AT TIME ZONE 'UTC')) = 0;

UPDATE "Repair"
   SET "enteredAt" = "enteredAt" + INTERVAL '12 hours'
 WHERE "enteredAt" IS NOT NULL
   AND EXTRACT(HOUR FROM ("enteredAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(MINUTE FROM ("enteredAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(SECOND FROM ("enteredAt" AT TIME ZONE 'UTC')) = 0;

UPDATE "Repair"
   SET "deliveredAt" = "deliveredAt" + INTERVAL '12 hours'
 WHERE "deliveredAt" IS NOT NULL
   AND EXTRACT(HOUR FROM ("deliveredAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(MINUTE FROM ("deliveredAt" AT TIME ZONE 'UTC')) = 0
   AND EXTRACT(SECOND FROM ("deliveredAt" AT TIME ZONE 'UTC')) = 0;
