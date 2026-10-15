/**
 * POST /api/caja/card-purchases
 *
 * spec Tarjetas oct '26 · Registra una compra con tarjeta de crédito y arma
 * sus cuotas (una por resumen), con las mismas reglas que el backoffice de
 * Legalistas: el primer resumen sale del día de cierre de la tarjeta y cada
 * cuota lleva el vencimiento de su resumen. No crea ningún CashMovement: la
 * plata sale de una caja recién cuando se paga cada resumen
 * (/api/caja/cards/[id]/pay).
 *
 * Body: { creditCardId, amount, concept, supplier?, notes?, reference?,
 *         purchasedAt?: ISO, installments?: 1..60, firstPeriod?: "AAAA-MM" }
 * `firstPeriod` es para corregir a mano el resumen de la primera cuota.
 */

import { NextResponse } from "next/server";
import { FINANCE_ROLES, getServerSession, verifyAuth } from "@/lib/auth-utils";
import { MAX_CUOTAS, PERIODO, planDeCuotas } from "@/lib/cuotas";
import { prisma } from "@/lib/prisma";

const texto = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : null;

export async function POST(request: Request) {
  const authError = await verifyAuth(request, FINANCE_ROLES);
  if (authError) return authError;
  const session = await getServerSession();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const {
    creditCardId,
    amount,
    concept,
    supplier,
    notes,
    reference,
    purchasedAt,
    installments,
    firstPeriod,
  } = body as Record<string, unknown>;

  if (typeof creditCardId !== "string" || !creditCardId) {
    return NextResponse.json(
      { error: "Tarjeta es obligatoria" },
      { status: 400 },
    );
  }
  const total = Number(amount);
  if (!Number.isFinite(total) || total <= 0) {
    return NextResponse.json({ error: "Importe inválido" }, { status: 400 });
  }
  if (typeof concept !== "string" || !concept.trim()) {
    return NextResponse.json(
      { error: "Concepto es obligatorio" },
      { status: 400 },
    );
  }
  const cuotas =
    installments === undefined || installments === null
      ? 1
      : Number(installments);
  if (!Number.isInteger(cuotas) || cuotas < 1 || cuotas > MAX_CUOTAS) {
    return NextResponse.json(
      { error: `Las cuotas van de 1 a ${MAX_CUOTAS}` },
      { status: 400 },
    );
  }
  if (
    firstPeriod !== undefined &&
    firstPeriod !== null &&
    firstPeriod !== "" &&
    (typeof firstPeriod !== "string" || !PERIODO.test(firstPeriod))
  ) {
    return NextResponse.json(
      { error: "El primer resumen es inválido" },
      { status: 400 },
    );
  }
  const fecha =
    typeof purchasedAt === "string" && purchasedAt
      ? new Date(purchasedAt)
      : new Date();
  if (Number.isNaN(fecha.getTime())) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const card = await prisma.creditCard.findUnique({
    where: { id: creditCardId },
  });
  if (!card || card.archivedAt) {
    return NextResponse.json(
      { error: "Tarjeta no encontrada" },
      { status: 404 },
    );
  }

  const purchase = await prisma.cardPurchase.create({
    data: {
      creditCardId,
      amount: total,
      concept: concept.trim(),
      supplier: texto(supplier),
      notes: texto(notes),
      reference: texto(reference),
      purchasedAt: fecha,
      createdById: session?.user?.id ?? null,
      installments: {
        create: planDeCuotas({
          fecha,
          total,
          cuotas,
          diaCierre: card.closingDay,
          diaVencimiento: card.dueDay,
          primerPeriodo:
            typeof firstPeriod === "string" && firstPeriod
              ? firstPeriod
              : undefined,
        }).map((c) => ({ ...c, creditCardId })),
      },
    },
    include: { installments: true },
  });

  return NextResponse.json({ purchase }, { status: 201 });
}
