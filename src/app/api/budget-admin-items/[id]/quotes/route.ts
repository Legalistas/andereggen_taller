/**
 * POST /api/budget-admin-items/[id]/quotes
 * Agrega una cotización de proveedor al item.
 * Body: {
 *   supplierName: string,
 *   price: number,
 *   partCode?: string,
 *   discount?: number,        // 0–100
 *   availability?: string,
 *   photos?: string[],
 *   notes?: string,
 * }
 *
 * Data interna — no sale en el PDF al cliente.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

function normalizePhotos(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const cleaned: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (t !== "") cleaned.push(t);
  }
  return cleaned;
}

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const item = await prisma.budgetAdminItem.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
  }

  const {
    supplierName,
    price,
    partCode,
    discount,
    availability,
    photos,
    notes,
  } = body as Record<string, unknown>;

  if (typeof supplierName !== "string" || supplierName.trim() === "") {
    return NextResponse.json(
      { error: "supplierName es requerido" },
      { status: 400 },
    );
  }
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return NextResponse.json(
      { error: "price debe ser un número >= 0" },
      { status: 400 },
    );
  }

  let discountNum: number | null = null;
  if (discount !== undefined && discount !== null && discount !== "") {
    const n = Number(discount);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json(
        { error: "discount debe estar entre 0 y 100" },
        { status: 400 },
      );
    }
    discountNum = n;
  }

  const photosClean = normalizePhotos(photos);
  if (photosClean === null) {
    return NextResponse.json(
      { error: "photos debe ser un array de strings" },
      { status: 400 },
    );
  }

  const quote = await prisma.budgetAdminQuote.create({
    data: {
      itemId: id,
      supplierName: supplierName.trim(),
      price: priceNum,
      partCode:
        typeof partCode === "string" && partCode.trim() !== ""
          ? partCode.trim()
          : null,
      discount: discountNum,
      availability:
        typeof availability === "string" && availability.trim() !== ""
          ? availability.trim()
          : null,
      photos: photosClean,
      notes:
        typeof notes === "string" && notes.trim() !== "" ? notes.trim() : null,
    },
  });

  return NextResponse.json({ quote }, { status: 201 });
}
