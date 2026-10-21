import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES } from "@/lib/roles";

/** Quién administra los rubros: finanzas y el administrador del taller. */
const MANAGE_ROLES = [...FINANCE_ROLES, "admin_taller"];

/**
 * GET /api/cash-concepts[?active=1]
 * Rubros de egreso con sus subcategorías. Con active=1 solo los activos
 * (lo que ofrece el selector al cargar un egreso).
 */
export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const activeOnly = new URL(request.url).searchParams.get("active") === "1";
  const concepts = await prisma.cashConcept.findMany({
    where: { parentId: null, ...(activeOnly && { isActive: true }) },
    orderBy: [{ order: "asc" }, { label: "asc" }],
    include: {
      children: {
        where: activeOnly ? { isActive: true } : undefined,
        orderBy: [{ order: "asc" }, { label: "asc" }],
      },
    },
  });

  return NextResponse.json({ concepts });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request, MANAGE_ROLES);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const { label, parentId, order, isActive } = body as Record<string, unknown>;
  if (typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const parent = typeof parentId === "string" && parentId ? parentId : null;
  if (parent) {
    const p = await prisma.cashConcept.findUnique({ where: { id: parent } });
    if (!p || p.parentId) {
      return NextResponse.json(
        { error: "El rubro padre no existe o ya es una subcategoría" },
        { status: 400 },
      );
    }
  }

  const dupe = await prisma.cashConcept.findFirst({
    where: { parentId: parent, label: { equals: label.trim(), mode: "insensitive" } },
  });
  if (dupe) {
    return NextResponse.json({ error: "Ya existe un rubro con ese nombre" }, { status: 409 });
  }

  const concept = await prisma.cashConcept.create({
    data: {
      label: label.trim(),
      parentId: parent,
      order: Number(order ?? 100),
      isActive: isActive === undefined ? true : Boolean(isActive),
    },
  });
  return NextResponse.json({ concept }, { status: 201 });
}
