/**
 * Sincronización del snapshot de cliente/vehículo de las reparaciones.
 *
 * Mismo problema y mismo criterio que en los presupuestos
 * (ver `budget-snapshot.ts`): la reparación copia cliente y vehículo al
 * crearse, así que una corrección posterior —un apellido mal escrito, la
 * patente cargada con un dígito de menos— no le llegaba nunca.
 *
 * Criterio (definido con el taller):
 *  - Mientras el auto está en el taller (antes de entregarlo), la tarjeta
 *    toma las correcciones: es el dato con el que se está trabajando.
 *  - Una vez entregada (o archivada), queda congelada: es el registro
 *    histórico de ese trabajo y de lo que se facturó.
 *
 * No se toca `insuranceCompany`: en la tarjeta es un campo editable —la
 * compañía que paga ESE trabajo puede ser la del tercero, distinta de la del
 * vehículo— y pisarlo borraría lo que el taller cargó a mano.
 */

import type { Prisma, RepairStatus } from "../../generated/prisma/client";
// Solo como tipo: el cliente real lo inyecta cada route.
import type { prisma } from "./prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

/**
 * Estados posteriores a la entrega. Se listan además de `deliveredAt` porque
 * una tarjeta puede moverse a mano a cobranza sin haber cargado la fecha.
 */
const POST_DELIVERY_STATUSES: RepairStatus[] = [
  "pendientes_cobro",
  "experiencia_cliente",
  "archivado",
];

/**
 * Refresca el snapshot de las reparaciones que siguen en el taller para un
 * cliente y/o un vehículo. Devuelve cuántas actualizó.
 */
export async function syncOpenRepairSnapshots(
  tx: Tx,
  where: { customerId?: string; vehicleId?: string },
): Promise<number> {
  if (!where.customerId && !where.vehicleId) return 0;

  const repairs = await tx.repair.findMany({
    where: {
      deliveredAt: null,
      archivedAt: null,
      status: { notIn: POST_DELIVERY_STATUSES },
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
