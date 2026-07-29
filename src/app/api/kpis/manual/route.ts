/**
 * PUT /api/kpis/manual
 *
 * spec KPIs jul '26 · Upsert de un valor manual (por ahora solo
 * "reclamos" del mes, pero el catálogo es extensible).
 *
 * Body: { metricKey, year, month (1-12), value, notes? }
 * Regla: si `value === 0 && !notes && ya existe una entrada`, borramos —
 * mismo patrón que Legalistas para que "0 sin nota" no ensucie la tabla.
 */

import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { MANUAL_KPI_KEYS } from "@/lib/kpis/catalog";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { metricKey, year, month, value, notes } = body as Record<
    string,
    unknown
  >;

  if (typeof metricKey !== "string" || !MANUAL_KPI_KEYS.has(metricKey)) {
    return NextResponse.json(
      { error: "metricKey no es un KPI manual válido" },
      { status: 400 },
    );
  }
  const y = Number(year);
  const m = Number(month);
  if (
    !Number.isInteger(y) ||
    y < 2000 ||
    y > 2100 ||
    !Number.isInteger(m) ||
    m < 1 ||
    m > 12
  ) {
    return NextResponse.json(
      { error: "year/month inválidos (year 2000-2100, month 1-12)" },
      { status: 400 },
    );
  }
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0) {
    return NextResponse.json(
      { error: "value debe ser un número >= 0" },
      { status: 400 },
    );
  }
  const notesText =
    typeof notes === "string" && notes.trim() ? notes.trim() : null;

  const existing = await prisma.monthlyKpiEntry.findUnique({
    where: {
      metricKey_year_month: {
        metricKey,
        year: y,
        month: m,
      },
    },
  });

  // Regla "0 sin nota → borrar" — ahorra la duplicación del botón trash.
  if (existing && v === 0 && !notesText) {
    await prisma.monthlyKpiEntry.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  const row = await prisma.monthlyKpiEntry.upsert({
    where: {
      metricKey_year_month: {
        metricKey,
        year: y,
        month: m,
      },
    },
    create: {
      metricKey,
      year: y,
      month: m,
      value: v,
      notes: notesText,
      createdById: session?.user?.id ?? null,
    },
    update: {
      value: v,
      notes: notesText,
    },
  });

  return NextResponse.json({ ok: true, row });
}
