import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;

    const source = await prisma.leadSource.findUnique({ where: { id } });
    if (!source) return NextResponse.json({ error: "Fuente no encontrada" }, { status: 404 });
    return NextResponse.json({ source });
}

export async function PATCH(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request, ["admin"]);
    if (authError) return authError;
    const { id } = await ctx.params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const existing = await prisma.leadSource.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Fuente no encontrada" }, { status: 404 });

    const { label, order, isActive } = body as Record<string, unknown>;

    // No permitimos cambiar la `key` — eso rompería referencias históricas en Lead.source.
    const updated = await prisma.leadSource.update({
        where: { id },
        data: {
            ...(label !== undefined && { label: label as string }),
            ...(order !== undefined && { order: Number(order) }),
            ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        },
    });

    return NextResponse.json({ source: updated });
}

export async function DELETE(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request, ["admin"]);
    if (authError) return authError;
    const { id } = await ctx.params;

    const existing = await prisma.leadSource.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Fuente no encontrada" }, { status: 404 });

    await prisma.leadSource.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
