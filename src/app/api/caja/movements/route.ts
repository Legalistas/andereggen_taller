/**
 * GET  /api/caja/movements  — historial de movimientos (con caja + tipo)
 * POST /api/caja/movements  — registra INGRESO o EGRESO en una caja
 *
 * Los cobros de facturas NO viven acá — se llenan vía RepairInvoicePayment
 * con cashBoxId, y la vista de caja los mergea al mostrarlos.
 */

import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "../../../../../generated/prisma/client";

const VALID_METHODS: PaymentMethod[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "CHEQUE",
  "TARJETA",
  "MERCADOPAGO",
  "OTRO",
];

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const cashBoxId = url.searchParams.get("cashBoxId");
  const monthParam = url.searchParams.get("month");

  const now = new Date();
  let monthRef: Date;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    monthRef = new Date(y, m - 1, 1);
  } else {
    monthRef = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const startOfMonth = monthRef;
  const startOfNextMonth = new Date(
    monthRef.getFullYear(),
    monthRef.getMonth() + 1,
    1,
  );

  // Traemos manual movements + payments del rango. Merge en la respuesta.
  const [movements, payments] = await Promise.all([
    prisma.cashMovement.findMany({
      where: {
        paidAt: { gte: startOfMonth, lt: startOfNextMonth },
        ...(cashBoxId && { cashBoxId }),
      },
      include: {
        cashBox: { select: { id: true, key: true, name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { paidAt: "desc" },
    }),
    prisma.repairInvoicePayment.findMany({
      where: {
        paidAt: { gte: startOfMonth, lt: startOfNextMonth },
        cashBoxId: cashBoxId ?? { not: null },
      },
      include: {
        cashBox: { select: { id: true, key: true, name: true } },
        invoice: {
          select: {
            number: true,
            repair: {
              select: {
                id: true,
                internalNumber: true,
                customerName: true,
                vehicleDomain: true,
              },
            },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  const rows = [
    ...movements.map((m) => ({
      id: `mov-${m.id}`,
      cashBox: m.cashBox,
      type: m.type as
        | "INGRESO"
        | "EGRESO"
        | "TRANSFER_IN"
        | "TRANSFER_OUT"
        | "PASE_IN"
        | "PASE_OUT",
      amount: Number(m.amount),
      method: m.method,
      concept: m.concept,
      reference: m.reference,
      notes: m.notes,
      paidAt: m.paidAt.toISOString(),
      createdBy: m.createdBy?.name ?? null,
      source: "manual" as const,
      transferGroupId: m.transferGroupId,
      linkedRepair: null,
    })),
    ...payments.map((p) => ({
      id: `pay-${p.id}`,
      cashBox: p.cashBox,
      type: "COBRO" as const,
      amount: Number(p.amount),
      method: p.method,
      concept: p.invoice.repair.customerName
        ? `Cobro factura ${p.invoice.number} · ${p.invoice.repair.customerName}`
        : `Cobro factura ${p.invoice.number}`,
      reference: p.reference,
      notes: p.notes,
      paidAt: p.paidAt.toISOString(),
      createdBy: null,
      source: "payment" as const,
      transferGroupId: null,
      linkedRepair: {
        id: p.invoice.repair.id,
        internalNumber: p.invoice.repair.internalNumber,
        customerName: p.invoice.repair.customerName,
        vehicleDomain: p.invoice.repair.vehicleDomain,
      },
    })),
  ].sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { cashBoxId, type, amount, method, concept, reference, notes, paidAt } =
    body as Record<string, unknown>;

  if (!cashBoxId || typeof cashBoxId !== "string") {
    return NextResponse.json({ error: "Caja es obligatoria" }, { status: 400 });
  }
  // spec v2 · Aceptamos PASE_IN / PASE_OUT además de INGRESO/EGRESO. Los
  // pases mueven plata en la caja pero no cuentan como ingreso/egreso
  // contable del mes.
  const ALLOWED_TYPES = new Set([
    "INGRESO",
    "EGRESO",
    "PASE_IN",
    "PASE_OUT",
  ]);
  if (typeof type !== "string" || !ALLOWED_TYPES.has(type)) {
    return NextResponse.json(
      { error: "type debe ser INGRESO, EGRESO, PASE_IN o PASE_OUT" },
      { status: 400 },
    );
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Importe inválido" }, { status: 400 });
  }
  if (!concept || typeof concept !== "string" || !concept.trim()) {
    return NextResponse.json(
      { error: "Concepto es obligatorio" },
      { status: 400 },
    );
  }
  const m: PaymentMethod =
    method && VALID_METHODS.includes(method as PaymentMethod)
      ? (method as PaymentMethod)
      : "EFECTIVO";

  const box = await prisma.cashBox.findUnique({ where: { id: cashBoxId } });
  if (!box) {
    return NextResponse.json({ error: "Caja no encontrada" }, { status: 404 });
  }

  const movement = await prisma.cashMovement.create({
    data: {
      cashBoxId,
      type: type as "INGRESO" | "EGRESO" | "PASE_IN" | "PASE_OUT",
      amount: parsedAmount,
      method: m,
      concept: concept.trim(),
      reference:
        typeof reference === "string" && reference.trim()
          ? reference.trim()
          : null,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      paidAt: paidAt ? new Date(paidAt as string) : new Date(),
      createdById: session?.user?.id ?? null,
    },
  });

  return NextResponse.json({ movement }, { status: 201 });
}
