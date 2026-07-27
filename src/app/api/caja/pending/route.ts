/**
 * GET  /api/caja/pending  — lista pagos preparados
 * POST /api/caja/pending  — crea un pago pendiente
 *
 * spec v2 · "Pagos para realizar" / "preparados". El equipo anota lo que
 * saben que van a pagar (proveedores, sueldos) antes de retirar la plata.
 * Cuando se materializa, /mark-paid crea el CashMovement EGRESO real.
 */

import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type {
  PaymentMethod,
  PendingCashPaymentStatus,
} from "../../../../../generated/prisma/client";

const VALID_METHODS: PaymentMethod[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "CHEQUE",
  "TARJETA",
  "MERCADOPAGO",
  "OTRO",
];

const VALID_STATUSES: PendingCashPaymentStatus[] = [
  "PENDIENTE",
  "PAGADO",
  "CANCELADO",
];

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get(
    "status",
  ) as PendingCashPaymentStatus | null;
  const cashBoxId = url.searchParams.get("cashBoxId");

  const rows = await prisma.pendingCashPayment.findMany({
    where: {
      ...(statusFilter && VALID_STATUSES.includes(statusFilter)
        ? { status: statusFilter }
        : { status: "PENDIENTE" }), // por defecto sólo lo que queda por pagar
      ...(cashBoxId && { cashBoxId }),
    },
    include: {
      cashBox: { select: { id: true, key: true, name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    rows: rows.map((r) => ({
      id: r.id,
      cashBox: r.cashBox,
      amount: Number(r.amount),
      method: r.method,
      concept: r.concept,
      reference: r.reference,
      notes: r.notes,
      dueDate: r.dueDate?.toISOString() ?? null,
      status: r.status,
      paidAt: r.paidAt?.toISOString() ?? null,
      createdBy: r.createdBy?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { cashBoxId, amount, method, concept, reference, notes, dueDate } =
    body as Record<string, unknown>;

  if (typeof cashBoxId !== "string" || !cashBoxId) {
    return NextResponse.json({ error: "Caja es obligatoria" }, { status: 400 });
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Importe inválido" }, { status: 400 });
  }
  if (typeof concept !== "string" || !concept.trim()) {
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

  const row = await prisma.pendingCashPayment.create({
    data: {
      cashBoxId,
      amount: parsedAmount,
      method: m,
      concept: concept.trim(),
      reference:
        typeof reference === "string" && reference.trim()
          ? reference.trim()
          : null,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      dueDate:
        typeof dueDate === "string" && dueDate
          ? new Date(dueDate)
          : null,
      createdById: session?.user?.id ?? null,
    },
  });

  return NextResponse.json({ row }, { status: 201 });
}
