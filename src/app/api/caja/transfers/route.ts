/**
 * POST /api/caja/transfers
 *
 * spec 4.3 v2 · Transferencia interna entre 2 cajas. Genera 2 rows
 * atómicos en CashMovement (TRANSFER_OUT en origen, TRANSFER_IN en destino)
 * compartiendo transferGroupId para poder mostrar la contraparte y no
 * duplicar al agregar totales globales.
 *
 * Body: { fromCashBoxId, toCashBoxId, amount, concept?, notes?, paidAt? }
 */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { fromCashBoxId, toCashBoxId, amount, concept, notes, paidAt } =
    body as Record<string, unknown>;

  if (typeof fromCashBoxId !== "string" || typeof toCashBoxId !== "string") {
    return NextResponse.json(
      { error: "Caja origen y destino son obligatorias" },
      { status: 400 },
    );
  }
  if (fromCashBoxId === toCashBoxId) {
    return NextResponse.json(
      { error: "Origen y destino no pueden ser la misma caja" },
      { status: 400 },
    );
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Importe inválido" }, { status: 400 });
  }

  const [fromBox, toBox] = await Promise.all([
    prisma.cashBox.findUnique({ where: { id: fromCashBoxId } }),
    prisma.cashBox.findUnique({ where: { id: toCashBoxId } }),
  ]);
  if (!fromBox || !toBox) {
    return NextResponse.json(
      { error: "Caja no encontrada" },
      { status: 404 },
    );
  }

  const transferGroupId = randomUUID();
  const when = paidAt ? new Date(paidAt as string) : new Date();
  const conceptText =
    typeof concept === "string" && concept.trim()
      ? concept.trim()
      : `Transferencia ${fromBox.name} → ${toBox.name}`;
  const notesText =
    typeof notes === "string" && notes.trim() ? notes.trim() : null;

  const [outMov, inMov] = await prisma.$transaction([
    prisma.cashMovement.create({
      data: {
        cashBoxId: fromCashBoxId,
        type: "TRANSFER_OUT",
        amount: parsedAmount,
        method: "TRANSFERENCIA",
        concept: conceptText,
        notes: notesText,
        transferGroupId,
        paidAt: when,
        createdById: session?.user?.id ?? null,
      },
    }),
    prisma.cashMovement.create({
      data: {
        cashBoxId: toCashBoxId,
        type: "TRANSFER_IN",
        amount: parsedAmount,
        method: "TRANSFERENCIA",
        concept: conceptText,
        notes: notesText,
        transferGroupId,
        paidAt: when,
        createdById: session?.user?.id ?? null,
      },
    }),
  ]);

  return NextResponse.json(
    {
      transferGroupId,
      movements: [outMov, inMov],
    },
    { status: 201 },
  );
}
