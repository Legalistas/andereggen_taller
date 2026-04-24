import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/tools/[id]/assign  { userId }  → asigna la herramienta al user y
 *   marca status = IN_USE. Falla si la tool está RETIRED o MAINTENANCE.
 * DELETE /api/tools/[id]/assign            → devuelve (limpia assignedTo y
 *   marca status = AVAILABLE). Idempotente.
 */

export async function POST(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;

    const body = await request.json().catch(() => null);
    const userId = (body as { userId?: string })?.userId;
    if (!userId) return NextResponse.json({ error: "Falta userId" }, { status: 400 });

    const tool = await prisma.tool.findUnique({ where: { id } });
    if (!tool) return NextResponse.json({ error: "Herramienta no encontrada" }, { status: 404 });

    if (tool.status === "RETIRED") {
        return NextResponse.json(
            { error: "La herramienta está dada de baja." },
            { status: 400 },
        );
    }
    if (tool.status === "MAINTENANCE") {
        return NextResponse.json(
            { error: "La herramienta está en mantenimiento." },
            { status: 400 },
        );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const updated = await prisma.tool.update({
        where: { id },
        data: { assignedToId: userId, status: "IN_USE" },
        include: { assignedTo: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ tool: updated });
}

export async function DELETE(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;

    const tool = await prisma.tool.findUnique({ where: { id } });
    if (!tool) return NextResponse.json({ error: "Herramienta no encontrada" }, { status: 404 });

    const updated = await prisma.tool.update({
        where: { id },
        data: {
            assignedToId: null,
            // Si estaba IN_USE la bajamos a AVAILABLE; si estaba en MAINTENANCE/RETIRED,
            // respetamos el estado manual.
            ...(tool.status === "IN_USE" && { status: "AVAILABLE" }),
        },
        include: { assignedTo: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ tool: updated });
}
