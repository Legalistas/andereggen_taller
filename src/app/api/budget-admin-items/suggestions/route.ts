/**
 * GET /api/budget-admin-items/suggestions?q=&limit=15
 *
 * Autocomplete para "Agregar repuesto a reemplazar" en la ficha
 * Administrativa. Devuelve descripciones históricas ÚNICAS (case-insensitive)
 * ordenadas por frecuencia de uso (más usadas primero). Si no hay `q`,
 * devuelve las descripciones más usadas del último período.
 *
 * No requiere paginación: se limita a top N (default 15, máx 50).
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const rawLimit = Number(url.searchParams.get("limit") ?? "15");
  const limit = Math.min(
    50,
    Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 15),
  );

  // groupBy(description) con COUNT — devuelve descripciones únicas
  // ordenadas por cantidad de veces que se usaron.
  const grouped = await prisma.budgetAdminItem.groupBy({
    by: ["description"],
    where: q
      ? { description: { contains: q, mode: "insensitive" } }
      : undefined,
    _count: { description: true },
    orderBy: { _count: { description: "desc" } },
    take: limit,
  });

  return NextResponse.json({
    suggestions: grouped.map((g) => ({
      description: g.description,
      uses: g._count.description,
    })),
  });
}
