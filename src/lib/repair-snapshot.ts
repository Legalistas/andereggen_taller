/**
 * Sincronización del snapshot de cliente/vehículo de las reparaciones.
 *
 * Mismo problema y mismo criterio que en los presupuestos
 * (ver `budget-snapshot.ts`): la reparación copia cliente y vehículo al
 * crearse, así que una corrección posterior —un apellido mal escrito, la
 * patente cargada con un dígito de menos— no le llegaba nunca.
 *
 * Criterio (spec CRM 6.4): se refrescan TODAS las tarjetas del cliente o del
 * vehículo, entregadas y archivadas incluidas. Solo se copian datos de
 * identidad (nombre, contacto, marca/modelo/patente); los importes y lo
 * facturado no se tocan, así que el registro histórico sigue valiendo.
 *
 * No se toca `insuranceCompany`: en la tarjeta es un campo editable —la
 * compañía que paga ESE trabajo puede ser la del tercero, distinta de la del
 * vehículo— y pisarlo borraría lo que el taller cargó a mano.
 */

import type { Prisma } from "../../generated/prisma/client";
// Solo como tipo: el cliente real lo inyecta cada route.
import type { prisma } from "./prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

/**
 * Refresca el snapshot de todas las reparaciones de un cliente y/o un
 * vehículo. Devuelve cuántas actualizó.
 */
export async function syncOpenRepairSnapshots(
  tx: Tx,
  where: { customerId?: string; vehicleId?: string },
): Promise<number> {
  if (!where.customerId && !where.vehicleId) return 0;

  const repairs = await tx.repair.findMany({
    where: {
      ...(where.customerId && { customerId: where.customerId }),
      ...(where.vehicleId && { vehicleId: where.vehicleId }),
    },
    select: {
      id: true,
      customer: { select: { name: true, email: true, phone: true } },
      vehicle: {
        select: { brand: true, model: true, year: true, domain: true },
      },
    },
  });

  for (const r of repairs) {
    await tx.repair.update({
      where: { id: r.id },
      data: {
        // Solo se refresca el lado que se editó.
        ...(where.customerId && r.customer
          ? {
              customerName: r.customer.name,
              customerEmail: r.customer.email,
              customerPhone: r.customer.phone,
            }
          : {}),
        ...(where.vehicleId && r.vehicle
          ? {
              vehicleBrand: r.vehicle.brand,
              vehicleModel: r.vehicle.model,
              vehicleYear: r.vehicle.year,
              vehicleDomain: r.vehicle.domain,
            }
          : {}),
      },
    });
  }

  return repairs.length;
}
