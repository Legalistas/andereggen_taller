import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;

    const user = await prisma.user.findUnique({
        where: { id },
        include: { role: { select: { id: true, name: true } } },
    });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { password: _pw, ...safe } = user;
    return NextResponse.json({ user: safe });
}

export async function PATCH(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;
    const session = await auth();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const { name, email, roleId, isActive } = body as {
        name?: string;
        email?: string;
        roleId?: string | null;
        isActive?: boolean;
    };

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    // Guard: no podés bloquearte/desactivarte a vos mismo
    if (isActive === false && session?.user?.id === id) {
        return NextResponse.json(
            { error: "No podés bloquear tu propia cuenta." },
            { status: 400 },
        );
    }

    // Validar email único si cambia
    if (email && email !== target.email) {
        const dupe = await prisma.user.findUnique({ where: { email } });
        if (dupe) {
            return NextResponse.json(
                { error: "Ya existe otro usuario con ese email." },
                { status: 409 },
            );
        }
    }

    // Validar rol si llega
    if (roleId) {
        const role = await prisma.role.findUnique({ where: { id: roleId } });
        if (!role) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    const updated = await prisma.user.update({
        where: { id },
        data: {
            ...(name !== undefined && { name }),
            ...(email !== undefined && { email }),
            ...(roleId !== undefined && { roleId }),
            ...(isActive !== undefined && { isActive }),
        },
        include: { role: { select: { id: true, name: true } } },
    });

    const { password: _pw, ...safe } = updated;
    return NextResponse.json({ user: safe });
}

export async function DELETE(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;
    const session = await auth();

    // Guard: no podés eliminarte a vos mismo
    if (session?.user?.id === id) {
        return NextResponse.json(
            { error: "No podés eliminar tu propia cuenta." },
            { status: 400 },
        );
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    try {
        await prisma.user.delete({ where: { id } });
    } catch (err) {
        // El user puede tener leads/budgets creados con FK; devolvemos mensaje útil.
        console.error("Delete user failed:", err);
        return NextResponse.json(
            {
                error:
                    "No se puede eliminar: el usuario tiene datos asociados (leads/presupuestos). Bloqueálo en vez de eliminar.",
            },
            { status: 409 },
        );
    }

    return NextResponse.json({ ok: true });
}
