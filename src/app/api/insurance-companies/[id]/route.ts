import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;

    const company = await prisma.insuranceCompany.findUnique({ where: { id } });
    if (!company) return NextResponse.json({ error: "Aseguradora no encontrada" }, { status: 404 });
    return NextResponse.json({ company });
}

export async function PATCH(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request, ["admin"]);
    if (authError) return authError;
    const { id } = await ctx.params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const existing = await prisma.insuranceCompany.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Aseguradora no encontrada" }, { status: 404 });

    const { name, phone, email, contactName, notes, isActive } = body as Record<string, unknown>;

    if (name && typeof name === "string" && name !== existing.name) {
        const dupe = await prisma.insuranceCompany.findUnique({ where: { name } });
        if (dupe) {
            return NextResponse.json({ error: "Ya existe otra aseguradora con ese nombre" }, { status: 409 });
        }
    }

    const updated = await prisma.insuranceCompany.update({
        where: { id },
        data: {
            ...(name !== undefined && { name: name as string }),
            ...(phone !== undefined && { phone: (phone as string) || null }),
            ...(email !== undefined && { email: (email as string) || null }),
            ...(contactName !== undefined && { contactName: (contactName as string) || null }),
            ...(notes !== undefined && { notes: (notes as string) || null }),
            ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        },
    });

    return NextResponse.json({ company: updated });
}

export async function DELETE(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request, ["admin"]);
    if (authError) return authError;
    const { id } = await ctx.params;

    const existing = await prisma.insuranceCompany.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Aseguradora no encontrada" }, { status: 404 });

    await prisma.insuranceCompany.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
