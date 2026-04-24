import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { PartMovementType } from "../../../../../../generated/prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const TYPES: PartMovementType[] = ["IN", "OUT", "ADJUST"];

export async function GET(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;

    const movements = await prisma.partMovement.findMany({
        where: { partId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
            createdBy: { select: { id: true, name: true, email: true } },
            budget: { select: { id: true, number: true } },
        },
    });

    return NextResponse.json({ movements });
}

/**
 * POST crea un movimiento manual (IN/OUT/ADJUST) y actualiza Part.stockQty
 * dentro de una transacción atómica. qty siempre positivo; el signo lo define type:
 *   IN     → stockQty += qty
 *   OUT    → stockQty -= qty
 *   ADJUST → stockQty = qty (valor absoluto — reemplaza el actual)
 */
export async function POST(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;
    const session = await auth();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const { type, qty, reason, note } = body as {
        type?: PartMovementType;
        qty?: number;
        reason?: string;
        note?: string;
    };

    if (!type || !TYPES.includes(type)) {
        return NextResponse.json({ error: "type debe ser IN, OUT o ADJUST" }, { status: 400 });
    }
    if (qty == null || Number(qty) < 0) {
        return NextResponse.json({ error: "qty debe ser >= 0" }, { status: 400 });
    }
    if (!reason || typeof reason !== "string" || !reason.trim()) {
        return NextResponse.json({ error: "reason es obligatorio" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
        const part = await tx.part.findUnique({ where: { id } });
        if (!part) return { error: "Repuesto no encontrado", status: 404 };

        const current = Number(part.stockQty);
        const delta = Number(qty);
        let newStock = current;
        if (type === "IN") newStock = current + delta;
        else if (type === "OUT") newStock = current - delta;
        else newStock = delta; // ADJUST = valor absoluto

        const movement = await tx.partMovement.create({
            data: {
                partId: id,
                type,
                qty: delta,
                reason: reason.trim(),
                note: note?.trim() || null,
                createdById: session?.user?.id ?? null,
            },
            include: {
                createdBy: { select: { id: true, name: true, email: true } },
            },
        });

        const updatedPart = await tx.part.update({
            where: { id },
            data: { stockQty: newStock },
        });

        return { movement, part: updatedPart };
    });

    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result, { status: 201 });
}
