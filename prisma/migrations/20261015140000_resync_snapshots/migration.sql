-- Backfill de una vez: los presupuestos y reparaciones vuelven a copiar los
-- datos de identidad del cliente y del vehículo desde la ficha actual.
--
-- Hasta ahora, un presupuesto aceptado o una reparación entregada quedaban
-- congelados y una corrección posterior (ej. "Yapul" → "Yapur") no les
-- llegaba. A partir de esta migración el sync corre siempre; esto empareja
-- los que ya habían quedado desfasados. No se toca ningún importe.

UPDATE "Budget" b
SET "customerName"    = c.name,
    "customerEmail"   = c.email,
    "customerPhone"   = c.phone,
    "customerDni"     = c.dni,
    "customerAddress" = c.address,
    "customerCity"    = c.city
FROM "Lead" l
JOIN "Customer" c ON c.id = l."customerId"
WHERE l.id = b."leadId";

UPDATE "Budget" b
SET "vehicleBrand"   = v.brand,
    "vehicleModel"   = v.model,
    "vehicleYear"    = v.year,
    "vehicleDomain"  = v.domain,
    "vehicleChassis" = v.chassis
FROM "Lead" l
JOIN "CustomerVehicle" v ON v.id = l."vehicleId"
WHERE l.id = b."leadId";

UPDATE "Repair" r
SET "customerName"  = c.name,
    "customerEmail" = c.email,
    "customerPhone" = c.phone
FROM "Customer" c
WHERE c.id = r."customerId";

UPDATE "Repair" r
SET "vehicleBrand"  = v.brand,
    "vehicleModel"  = v.model,
    "vehicleYear"   = v.year,
    "vehicleDomain" = v.domain
FROM "CustomerVehicle" v
WHERE v.id = r."vehicleId";
