import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { PartCategory } from "../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const CATEGORIES: PartCategory[] = [
    "CARROCERIA",
    "CRISTALERIA",
    "MECANICA",
    "ELECTRICO",
    "PINTURA",
    "FRENOS",
    "SUSPENSION",
    "FILTROS",
    "ILUMINACION",
    "INTERIOR",
    "OTROS",
];

export async function GET(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;

    const part = await prisma.part.findUnique({
        where: { id },
        include: {
            movements: {
                orderBy: { createdAt: "desc" },
                take: 20,
                include: {
                    createdBy: { select: { id: true, name: true, email: true } },
                    budget: { select: { id: true, number: true } },
                },
            },
        },
    });
    if (!part) return NextResponse.json({ error: "Repuesto no encontrado" }, { status: 404 });
    return NextResponse.json({ part });
}

export async function PATCH(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const existing = await prisma.part.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Repuesto no encontrado" }, { status: 404 });

    const {
        sku,
        name,
        description,
        brand,
        appliesTo,
        category,
        costPrice,
        salePrice,
        stockMin,
        isActive,
    } = body as Record<string, unknown>;

    if (category && !CATEGORIES.includes(category as PartCategory)) {
        return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }

    // Validar SKU único si cambia
    if (sku && typeof sku === "string" && sku !== existing.sku) {
        const dupe = await prisma.part.findUnique({ where: { sku } });
        if (dupe) {
            return NextResponse.json({ error: "Ya existe otro repuesto con ese SKU" }, { status: 409 });
        }
    }

    // Nota: stockQty NO se toca por PATCH. Se modifica SOLO vía POST /movements
    // para que quede siempre auditado. stockMin sí es editable.
    const updated = await prisma.part.update({
        where: { id },
        data: {
            ...(sku !== undefined && { sku: (sku as string) || null }),
            ...(name !== undefined && { name: name as string }),
            ...(description !== undefined && { description: (description as string) || null }),
            ...(brand !== undefined && { brand: (brand as string) || null }),
            ...(appliesTo !== undefined && { appliesTo: (appliesTo as string) || null }),
            ...(category !== undefined && { category: category as PartCategory }),
            ...(costPrice !== undefined && { costPrice: Number(costPrice) }),
            ...(salePrice !== undefined && { salePrice: Number(salePrice) }),
            ...(stockMin !== undefined && { stockMin: Number(stockMin) }),
            ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        },
    });

    return NextResponse.json({ part: updated });
}

export async function DELETE(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;

    const existing = await prisma.part.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Repuesto no encontrado" }, { status: 404 });

    try {
        await prisma.part.delete({ where: { id } });
    } catch (err) {
        console.error("Delete part failed:", err);
        return NextResponse.json(
            {
                error:
                    "No se puede eliminar: el repuesto tiene movimientos o está usado en presupuestos. Desactivalo en vez de eliminar.",
            },
            { status: 409 },
        );
    }

    return NextResponse.json({ ok: true });
}
