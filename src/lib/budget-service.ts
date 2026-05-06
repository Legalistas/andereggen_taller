/**
 * Lógica de dominio para Budget — reutilizable entre rutas POST y PATCH.
 * Valida payload, recalcula totales y persiste en transacción.
 */

import type {
  ConceptCategory,
  ConceptType,
  Prisma,
} from "../../generated/prisma/client";
import {
  computeBudgetTotals,
  computeConceptSubtotal,
  computePartSubtotal,
} from "./budget-catalog";
import { prisma } from "./prisma";
import { getAppSettings } from "./settings";

export type ConceptPayload = {
  type: ConceptType;
  category: ConceptCategory;
  order?: number;
  subdetails?: string[];
  additionalDetail?: string | null;
  units?: number | null;
  unitValue?: number | null;
  fixedAmount?: number | null;
  fixedDescription?: string | null;
};

export type PartPayload = {
  order?: number;
  partId?: string | null; // opcional — FK al catálogo si viene del autocomplete
  quantity: number;
  description: string;
  unitPrice: number;
};

export type BudgetPayload = {
  /** Si se pasa, fuerza este Nº de presupuesto.
   *  Al crear: en lugar de usar max+1.
   *  Al editar: cambia el número existente.
   *  Falla si ya existe en otro budget. */
  number?: number;
  ivaRate?: number;
  validityDays?: number;
  deliveryDays?: number;
  paymentCondition?: string;
  observations?: string | null;
  /** Aclaración libre sobre los repuestos a proveer — sale en el PDF al cliente. */
  partsNote?: string | null;
  /** Pintura perlada tricapa — se setea por presupuesto (un mismo auto
   *  puede tener distintos budgets con o sin tricapa). */
  perladoTricapa?: boolean;
  concepts: ConceptPayload[];
  parts: PartPayload[];
};

export class BudgetValidationError extends Error {
  status = 400;
}

export function validateBudgetPayload(p: unknown): BudgetPayload {
  if (!p || typeof p !== "object")
    throw new BudgetValidationError("Invalid body");
  const body = p as Record<string, unknown>;

  const concepts = Array.isArray(body.concepts)
    ? (body.concepts as ConceptPayload[])
    : [];
  const parts = Array.isArray(body.parts) ? (body.parts as PartPayload[]) : [];

  concepts.forEach((c, idx) => {
    if (!c.type || !["DESCRIPTIVO", "UNIDADES", "FIJO"].includes(c.type)) {
      throw new BudgetValidationError(`concepts[${idx}].type invalid`);
    }
    if (!c.category)
      throw new BudgetValidationError(`concepts[${idx}].category required`);
    if (c.type === "UNIDADES") {
      if (c.units == null || c.unitValue == null) {
        throw new BudgetValidationError(
          `concepts[${idx}] requires units and unitValue`,
        );
      }
    }
    if (c.type === "FIJO") {
      if (c.fixedAmount == null) {
        throw new BudgetValidationError(
          `concepts[${idx}] requires fixedAmount`,
        );
      }
    }
  });

  parts.forEach((pt, idx) => {
    if (pt.quantity == null || pt.unitPrice == null || !pt.description) {
      throw new BudgetValidationError(
        `parts[${idx}] requires quantity, unitPrice, description`,
      );
    }
  });

  // Validar number opcional: si viene, debe ser un entero positivo
  let parsedNumber: number | undefined;
  if (body.number !== undefined && body.number !== null && body.number !== "") {
    const n = Number(body.number);
    if (!Number.isInteger(n) || n <= 0) {
      throw new BudgetValidationError(
        "El número de presupuesto debe ser un entero positivo",
      );
    }
    parsedNumber = n;
  }

  return {
    number: parsedNumber,
    ivaRate: typeof body.ivaRate === "number" ? body.ivaRate : undefined,
    validityDays:
      typeof body.validityDays === "number" ? body.validityDays : undefined,
    deliveryDays:
      typeof body.deliveryDays === "number" ? body.deliveryDays : undefined,
    paymentCondition:
      typeof body.paymentCondition === "string"
        ? body.paymentCondition
        : undefined,
    observations:
      typeof body.observations === "string" ? body.observations : null,
    partsNote: typeof body.partsNote === "string" ? body.partsNote : null,
    perladoTricapa:
      typeof body.perladoTricapa === "boolean" ? body.perladoTricapa : undefined,
    concepts,
    parts,
  };
}

/**
 * Próximo número correlativo global (max + 1).
 * Aceptable para MVP con poca concurrencia; en prod migrar a SEQUENCE de Postgres.
 */
export async function nextBudgetNumber(
  tx: Prisma.TransactionClient = prisma as unknown as Prisma.TransactionClient,
): Promise<number> {
  const agg = await tx.budget.aggregate({ _max: { number: true } });
  return (agg._max.number ?? 0) + 1;
}

function computedSubtotals(payload: BudgetPayload) {
  const totals = computeBudgetTotals({
    concepts: payload.concepts.map((c) => ({
      type: c.type,
      units: c.units,
      unitValue: c.unitValue,
      fixedAmount: c.fixedAmount,
    })),
    parts: payload.parts.map((p) => ({
      quantity: p.quantity,
      unitPrice: p.unitPrice,
    })),
    ivaRate: payload.ivaRate,
  });
  return totals;
}

function mapConceptsForCreate(payload: BudgetPayload) {
  return payload.concepts.map((c, idx) => ({
    type: c.type,
    category: c.category,
    order: c.order ?? idx,
    subdetails: c.type === "DESCRIPTIVO" ? (c.subdetails ?? []) : [],
    additionalDetail: c.additionalDetail ?? null,
    units: c.type === "UNIDADES" ? (c.units ?? 0) : null,
    unitValue: c.type === "UNIDADES" ? (c.unitValue ?? 0) : null,
    fixedAmount: c.type === "FIJO" ? (c.fixedAmount ?? 0) : null,
    fixedDescription: c.type === "FIJO" ? (c.fixedDescription ?? null) : null,
    subtotal: computeConceptSubtotal({
      type: c.type,
      units: c.units,
      unitValue: c.unitValue,
      fixedAmount: c.fixedAmount,
    }),
  }));
}

function mapPartsForCreate(payload: BudgetPayload) {
  return payload.parts.map((p, idx) => ({
    order: p.order ?? idx,
    partId: p.partId ?? null,
    quantity: p.quantity,
    description: p.description,
    unitPrice: p.unitPrice,
    subtotal: computePartSubtotal(p),
  }));
}

export async function createBudgetForLead(params: {
  leadId: string;
  payload: BudgetPayload;
  createdById?: string | null;
}) {
  const { leadId, payload, createdById = null } = params;

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      include: { customer: true, vehicle: true },
    });
    if (!lead) throw new BudgetValidationError("Lead not found");
    if (!lead.vehicle) {
      throw new BudgetValidationError(
        "Lead has no vehicle — assign one before creating a budget",
      );
    }

    const settings = await getAppSettings();
    const ivaRateForCalc = payload.ivaRate ?? Number(settings.defaultIvaRate);
    const totals = computedSubtotals({ ...payload, ivaRate: ivaRateForCalc });

    // Si el usuario pasó un número manual, validamos que no choque con uno
    // existente; si no, calculamos el correlativo (max+1).
    let number: number;
    if (payload.number !== undefined) {
      const dupe = await tx.budget.findUnique({
        where: { number: payload.number },
        select: { id: true },
      });
      if (dupe) {
        throw new BudgetValidationError(
          `Ya existe un presupuesto con el número ${payload.number}.`,
        );
      }
      number = payload.number;
    } else {
      number = await nextBudgetNumber(tx);
    }

    const budget = await tx.budget.create({
      data: {
        leadId,
        number,
        createdById,
        // Snapshot
        customerName: lead.customer.name,
        customerEmail: lead.customer.email,
        customerPhone: lead.customer.phone,
        customerDni: lead.customer.dni,
        customerAddress: lead.customer.address,
        vehicleBrand: lead.vehicle.brand,
        vehicleModel: lead.vehicle.model,
        vehicleYear: lead.vehicle.year,
        vehicleDomain: lead.vehicle.domain,
        vehicleChassis: lead.vehicle.chassis,
        // Si el payload lo trae, gana; si no, fallback al flag del vehículo (compatibilidad).
        vehiclePerladoTricapa:
          payload.perladoTricapa ?? lead.vehicle.perladoTricapa,
        vehicleInsurance: lead.vehicle.secure,
        insuranceCoverageType: lead.vehicle.coverageType,
        insuranceFranchise: lead.vehicle.franchise,
        // Observaciones (defaults desde AppSettings; el payload puede sobrescribir)
        validityDays: payload.validityDays ?? settings.defaultValidityDays,
        deliveryDays: payload.deliveryDays ?? settings.defaultDeliveryDays,
        paymentCondition:
          payload.paymentCondition ?? settings.defaultPaymentCondition,
        observations: payload.observations,
        partsNote: payload.partsNote ?? null,
        // Totales
        laborSubtotal: totals.laborSubtotal,
        ivaRate: totals.ivaRate,
        ivaAmount: totals.ivaAmount,
        laborTotal: totals.laborTotal,
        partsSubtotal: totals.partsSubtotal,
        grandTotal: totals.grandTotal,
        // Nested writes
        concepts: { create: mapConceptsForCreate(payload) },
        parts: { create: mapPartsForCreate(payload) },
      },
      include: {
        concepts: { orderBy: { order: "asc" } },
        parts: { orderBy: { order: "asc" } },
      },
    });

    // Al crear un presupuesto, si el lead estaba en "solicitud", avanza a "control"
    if (lead.status === "solicitud") {
      await tx.lead.update({
        where: { id: leadId },
        data: { status: "control" },
      });
    }

    return budget;
  });
}

export async function updateBudget(params: {
  id: string;
  payload: BudgetPayload;
}) {
  const { id, payload } = params;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.budget.findUnique({ where: { id } });
    if (!existing) throw new BudgetValidationError("Budget not found");
    if (existing.status !== "draft") {
      throw new BudgetValidationError(
        `Budget in status "${existing.status}" cannot be edited; create a new revision instead`,
      );
    }

    const totals = computedSubtotals(payload);

    // Si el usuario cambió el número, validamos que no choque con otro budget.
    if (
      payload.number !== undefined &&
      payload.number !== existing.number
    ) {
      const dupe = await tx.budget.findUnique({
        where: { number: payload.number },
        select: { id: true },
      });
      if (dupe && dupe.id !== id) {
        throw new BudgetValidationError(
          `Ya existe un presupuesto con el número ${payload.number}.`,
        );
      }
    }

    // Estrategia: reemplazar conceptos y partes (los hijos son de identidad del budget).
    await tx.budgetConcept.deleteMany({ where: { budgetId: id } });
    await tx.budgetPart.deleteMany({ where: { budgetId: id } });

    return tx.budget.update({
      where: { id },
      data: {
        number: payload.number ?? existing.number,
        validityDays: payload.validityDays ?? existing.validityDays,
        deliveryDays: payload.deliveryDays ?? existing.deliveryDays,
        paymentCondition: payload.paymentCondition ?? existing.paymentCondition,
        observations: payload.observations ?? existing.observations,
        partsNote: payload.partsNote ?? existing.partsNote,
        vehiclePerladoTricapa:
          payload.perladoTricapa ?? existing.vehiclePerladoTricapa,
        laborSubtotal: totals.laborSubtotal,
        ivaRate: totals.ivaRate,
        ivaAmount: totals.ivaAmount,
        laborTotal: totals.laborTotal,
        partsSubtotal: totals.partsSubtotal,
        grandTotal: totals.grandTotal,
        concepts: { create: mapConceptsForCreate(payload) },
        parts: { create: mapPartsForCreate(payload) },
      },
      include: {
        concepts: { orderBy: { order: "asc" } },
        parts: { orderBy: { order: "asc" } },
      },
    });
  });
}
