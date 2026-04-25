import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type {
  ToolCategory,
  ToolStatus,
} from "../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const CATEGORIES: ToolCategory[] = [
  "NEUMATICA",
  "HIDRAULICA",
  "ELECTRICA",
  "MANUAL",
  "ELEVACION",
  "SOLDADURA",
  "PINTURA",
  "DIAGNOSTICO",
  "OTROS",
];

const STATUSES: ToolStatus[] = [
  "AVAILABLE",
  "IN_USE",
  "MAINTENANCE",
  "RETIRED",
];

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const tool = await prisma.tool.findUnique({
    where: { id },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  });
  if (!tool)
    return NextResponse.json(
      { error: "Herramienta no encontrada" },
      { status: 404 },
    );
  return NextResponse.json({ tool });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.tool.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json(
      { error: "Herramienta no encontrada" },
      { status: 404 },
    );

  const {
    code,
    name,
    description,
    brand,
    category,
    status,
    location,
    cost,
    acquiredAt,
    notes,
    isActive,
  } = body as Record<string, unknown>;

  if (category && !CATEGORIES.includes(category as ToolCategory)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }
  if (status && !STATUSES.includes(status as ToolStatus)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  if (code && typeof code === "string" && code !== existing.code) {
    const dupe = await prisma.tool.findUnique({ where: { code } });
    if (dupe) {
      return NextResponse.json(
        { error: "Ya existe otra herramienta con ese código" },
        { status: 409 },
      );
    }
  }

  // Nota: assignedToId no se toca por PATCH directo — usar /assign para esa lógica.
  // El cambio de status sí se puede hacer por acá para MAINTENANCE/RETIRED/AVAILABLE.
  // Si status pasa a AVAILABLE y había asignación, limpiamos.
  const extraData: Partial<Record<string, unknown>> = {};
  if (
    status === "AVAILABLE" ||
    status === "MAINTENANCE" ||
    status === "RETIRED"
  ) {
    if (existing.assignedToId) extraData.assignedToId = null;
  }

  const updated = await prisma.tool.update({
    where: { id },
    data: {
      ...(code !== undefined && { code: (code as string) || null }),
      ...(name !== undefined && { name: name as string }),
      ...(description !== undefined && {
        description: (description as string) || null,
      }),
      ...(brand !== undefined && { brand: (brand as string) || null }),
      ...(category !== undefined && { category: category as ToolCategory }),
      ...(status !== undefined && { status: status as ToolStatus }),
      ...(location !== undefined && { location: (location as string) || null }),
      ...(cost !== undefined && { cost: Number(cost) }),
      ...(acquiredAt !== undefined && {
        acquiredAt: acquiredAt ? new Date(acquiredAt as string) : null,
      }),
      ...(notes !== undefined && { notes: (notes as string) || null }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      ...extraData,
    },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ tool: updated });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.tool.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json(
      { error: "Herramienta no encontrada" },
      { status: 404 },
    );

  await prisma.tool.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
