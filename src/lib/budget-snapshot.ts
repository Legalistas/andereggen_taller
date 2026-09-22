/**
 * Sincronización del snapshot de cliente/vehículo de los presupuestos.
 *
 * Un presupuesto copia los datos del cliente y del vehículo al crearse, para
 * que el PDF que recibió el cliente no cambie nunca. El costo de eso es que
 * cuando el taller corrige un dato después (un apellido mal escrito, el
 * chasis, la franquicia), el presupuesto seguía mostrando el dato viejo.
 *
 * Criterio (definido con el taller):
 *  - Presupuestos NO aceptados (draft / sent / expired): se refrescan solos
 *    cada vez que se edita el cliente o el vehículo. Todavía se están
 *    negociando, así que lo correcto es el dato actual.
 *  - Aceptados y rechazados: quedan congelados. El cliente ya los aceptó (o
 *    los rechazó) con esos datos. Se pueden refrescar a mano con
 *    POST /api/budgets/[id]/refresh-snapshot desde la ficha.
 *
 * Nunca se toca `vehiclePerladoTricapa`: en el presupuesto es un dato de
 * precio que el operador puede haber puesto distinto al del vehículo a
 * propósito, y pisarlo cambiaría la mano de obra de pintura.
 */

import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "./prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

/** Estados cuyo snapshot se refresca automáticamente. */
export const AUTO_SYNC_STATUSES = ["draft", "sent", "expired"] as const;

type CustomerSource = {
  name: string;
  email: string;
  phone: string;
  dni: string | null;
  address: string | null;
  city: string | null;
};

type VehicleSource = {
  brand: string;
  model: string;
  year: string;
  domain: string;
  chassis: string | null;
  secure: string;
  coverageType: string | null;
  franchise: Prisma.Decimal | null;
};

function customerSnapshot(c: CustomerSource) {
  return {
    customerName: c.name,
    customerEmail: c.email,
    customerPhone: c.phone,
    customerDni: c.dni,
    customerAddress: c.address,
    customerCity: c.city,
  };
}

function vehicleSnapshot(v: VehicleSource) {
  return {
    vehicleBrand: v.brand,
    vehicleModel: v.model,
    vehicleYear: v.year,
    vehicleDomain: v.domain,
    vehicleChassis: v.chassis,
    vehicleInsurance: v.secure,
    insuranceCoverageType: v.coverageType,
    insuranceFranchise: v.franchise,
  };
}

/**
 * Refresca el snapshot de los presupuestos abiertos de un cliente y/o de un
 * vehículo. Devuelve cuántos actualizó (para loguear o avisar en la UI).
 *
 * Se llama después de guardar el cliente o el vehículo. Si algo falla no
 * debería voltear la edición: los callers lo envuelven y logean.
 */
export async function syncOpenBudgetSnapshots(
  tx: Tx,
  where: { customerId?: string; vehicleId?: string },
): Promise<number> {
  if (!where.customerId && !where.vehicleId) return 0;

  const budgets = await tx.budget.findMany({
    where: {
      status: { in: [...AUTO_SYNC_STATUSES] },
      lead: {
        ...(where.customerId && { customerId: where.customerId }),
        ...(where.vehicleId && { vehicleId: where.vehicleId }),
      },
    },
    select: {
      id: true,
      lead: {
        select: {
          customer: {
            select: {
              name: true,
              email: true,
              phone: true,
              dni: true,
              address: true,
              city: true,
            },
          },
          vehicle: {
            select: {
              brand: true,
              model: true,
              year: true,
              domain: true,
              chassis: true,
              secure: true,
              coverageType: true,
              franchise: true,
            },
          },
        },
      },
    },
  });

  for (const b of budgets) {
    await tx.budget.update({
      where: { id: b.id },
      data: {
        // Solo se refresca el lado que se editó: si cambió el cliente no
        // hace falta reescribir los campos del vehículo y viceversa.
        ...(where.customerId ? customerSnapshot(b.lead.customer) : {}),
        ...(where.vehicleId && b.lead.vehicle
          ? vehicleSnapshot(b.lead.vehicle)
          : {}),
      },
    });
  }

  return budgets.length;
}

/**
 * Refresca el snapshot de UN presupuesto contra los datos actuales, sin
 * importar el estado. Es lo que hace el botón "Actualizar datos" de la ficha,
 * para los presupuestos ya aceptados.
 */
export async function refreshBudgetSnapshot(budgetId: string) {
  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
    select: {
      id: true,
      lead: {
        select: {
          customer: {
            select: {
              name: true,
              email: true,
              phone: true,
              dni: true,
              address: true,
              city: true,
            },
          },
          vehicle: {
            select: {
              brand: true,
              model: true,
              year: true,
              domain: true,
              chassis: true,
              secure: true,
              coverageType: true,
              franchise: true,
            },
          },
        },
      },
    },
  });
  if (!budget) return null;

  return prisma.budget.update({
    where: { id: budgetId },
    data: {
      ...customerSnapshot(budget.lead.customer),
      ...(budget.lead.vehicle ? vehicleSnapshot(budget.lead.vehicle) : {}),
    },
  });
}
