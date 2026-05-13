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
      // Aceptamos dos modos:
      //  - desglose: units + unitValue
      //  - importe directo: fixedAmount (CHAPA/PINTURA cobrados como total)
      const hasBreakdown = c.units != null && c.unitValue != null;
      const hasFlat = c.fixedAmount != null;
      if (!hasBreakdown && !hasFlat) {
        throw new BudgetValidationError(
          `concepts[${idx}] requires units+unitValue or fixedAmount`,
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
 * Próximo número correlativo global (max + 1). Solo considera presupuestos
 * originales (extensionSuffix=0); las ampliaciones heredan el número del padre.
 * Aceptable para MVP con poca concurrencia; en prod migrar a SEQUENCE de Postgres.
 */
export async function nextBudgetNumber(
  tx: Prisma.TransactionClient = prisma as unknown as Prisma.TransactionClient,
): Promise<number> {
  const agg = await tx.budget.aggregate({
    _max: { number: true },
    where: { extensionSuffix: 0 },
  });
  return (agg._max.number ?? 0) + 1;
}

/**
 * Próximo `extensionSuffix` para ampliaciones de un presupuesto dado.
 * Devuelve 1 si todavía no hay ampliaciones, 2 si ya hay A1, etc.
 */
export async function nextExtensionSuffix(
  parentNumber: number,
  tx: Prisma.TransactionClient = prisma as unknown as Prisma.TransactionClient,
): Promise<number> {
  const agg = await tx.budget.aggregate({
    _max: { extensionSuffix: true },
    where: { number: parentNumber },
  });
  return (agg._max.extensionSuffix ?? 0) + 1;
}

/**
 * Display del número: "#3576" para originales, "#3576-A1" para ampliaciones.
 * Se usa en UI y PDF.
 */
export function formatBudgetDisplayNumber(
  number: number,
  extensionSuffix: number,
): string {
  return extensionSuffix > 0
    ? `${number}-A${extensionSuffix}`
    : `${number}`;
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
  return payload.concepts.map((c, idx) => {
    // UNIDADES en modo "importe directo": units/unitValue van null y el total
    // se guarda en fixedAmount. Detectamos por la ausencia de desglose.
    const flatUnidades =
      c.type === "UNIDADES" &&
      !((c.units ?? 0) > 0 && (c.unitValue ?? 0) > 0) &&
      (c.fixedAmount ?? 0) > 0;
    return {
      type: c.type,
      category: c.category,
      order: c.order ?? idx,
      subdetails: c.type === "DESCRIPTIVO" ? (c.subdetails ?? []) : [],
      additionalDetail: c.additionalDetail ?? null,
      units: c.type === "UNIDADES" && !flatUnidades ? (c.units ?? 0) : null,
      unitValue:
        c.type === "UNIDADES" && !flatUnidades ? (c.unitValue ?? 0) : null,
      fixedAmount:
        c.type === "FIJO" || flatUnidades ? (c.fixedAmount ?? 0) : null,
      fixedDescription: c.type === "FIJO" ? (c.fixedDescription ?? null) : null,
      subtotal: computeConceptSubtotal({
        type: c.type,
        units: c.units,
        unitValue: c.unitValue,
        fixedAmount: c.fixedAmount,
      }),
    };
  });
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

    // Si el usuario pasó un número manual, validamos que no choque con un
    // original existente; si no, calculamos el correlativo (max+1).
    // Solo miramos `extensionSuffix=0` porque las ampliaciones comparten
    // número con su padre y eso es esperado.
    let number: number;
    if (payload.number !== undefined) {
      const dupe = await tx.budget.findFirst({
        where: { number: payload.number, extensionSuffix: 0 },
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

    // Si el usuario cambió el número, validamos que no choque con otro
    // original. Las ampliaciones no permiten cambiar el número manualmente.
    if (
      payload.number !== undefined &&
      payload.number !== existing.number &&
      existing.extensionSuffix === 0
    ) {
      const dupe = await tx.budget.findFirst({
        where: { number: payload.number, extensionSuffix: 0 },
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

export type ExtensionPayer = "SEGURO" | "FRANQUICIA" | "PARTICULAR";

/**
 * Crea una ampliación de un presupuesto existente. Hereda el `number` del
 * padre, le asigna el próximo `extensionSuffix` (A1, A2…) y copia el
 * snapshot de cliente/vehículo del padre (mismo lead/auto).
 *
 * El payload contiene SOLO los conceptos/partes EXTRA — el seguro recibe
 * la ampliación como un PDF aparte que se suma al ppto original.
 */
export async function extendBudget(params: {
  parentId: string;
  payer: ExtensionPayer;
  payload: BudgetPayload;
  createdById?: string | null;
}) {
  const { parentId, payer, payload, createdById = null } = params;
  if (!["SEGURO", "FRANQUICIA", "PARTICULAR"].includes(payer)) {
    throw new BudgetValidationError("extensionPayer inválido");
  }

  return prisma.$transaction(async (tx) => {
    const parent = await tx.budget.findUnique({ where: { id: parentId } });
    if (!parent) throw new BudgetValidationError("Presupuesto padre no encontrado");
    // No permitimos ampliar una ampliación — siempre se ata al original.
    // Si vienen con un id de ampliación, redirigimos al padre real.
    const rootId = parent.parentBudgetId ?? parent.id;
    const root =
      rootId === parent.id
        ? parent
        : await tx.budget.findUnique({ where: { id: rootId } });
    if (!root)
      throw new BudgetValidationError("Presupuesto raíz no encontrado");

    const settings = await getAppSettings();
    const ivaRateForCalc = payload.ivaRate ?? Number(settings.defaultIvaRate);
    const totals = computedSubtotals({ ...payload, ivaRate: ivaRateForCalc });

    const suffix = await nextExtensionSuffix(root.number, tx);

    return tx.budget.create({
      data: {
        leadId: root.leadId,
        number: root.number,
        extensionSuffix: suffix,
        parentBudgetId: root.id,
        extensionPayer: payer,
        createdById,
        // Snapshot heredado del padre — el cliente/vehículo no cambian.
        customerName: root.customerName,
        customerEmail: root.customerEmail,
        customerPhone: root.customerPhone,
        customerDni: root.customerDni,
        customerAddress: root.customerAddress,
        vehicleBrand: root.vehicleBrand,
        vehicleModel: root.vehicleModel,
        vehicleYear: root.vehicleYear,
        vehicleDomain: root.vehicleDomain,
        vehicleChassis: root.vehicleChassis,
        vehiclePerladoTricapa:
          payload.perladoTricapa ?? root.vehiclePerladoTricapa,
        vehicleInsurance: root.vehicleInsurance,
        insuranceCoverageType: root.insuranceCoverageType,
        insuranceFranchise: root.insuranceFranchise,
        validityDays: payload.validityDays ?? settings.defaultValidityDays,
        deliveryDays: payload.deliveryDays ?? settings.defaultDeliveryDays,
        paymentCondition:
          payload.paymentCondition ?? settings.defaultPaymentCondition,
        observations: payload.observations,
        partsNote: payload.partsNote ?? null,
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
