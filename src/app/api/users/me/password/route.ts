import argon2 from "argon2";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/users/me/password
 * Body: { currentPassword, newPassword }
 *
 * - currentPassword: opcional si el user es OAuth y nunca setteó una.
 * - newPassword: mínimo 8 caracteres.
 */
export async function PATCH(request: Request) {
    const authError = await verifyAuth(request);
    if (authError) return authError;

    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const currentPassword = (body as { currentPassword?: string })?.currentPassword ?? "";
    const newPassword = (body as { newPassword?: string })?.newPassword ?? "";

    if (typeof newPassword !== "string" || newPassword.length < 8) {
        return NextResponse.json(
            { error: "La contraseña nueva debe tener al menos 8 caracteres" },
            { status: 400 },
        );
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Si el usuario ya tenía password, verificamos la actual
    if (user.password) {
        if (!currentPassword) {
            return NextResponse.json({ error: "Ingresá tu contraseña actual" }, { status: 400 });
        }
        const ok = await argon2.verify(user.password, currentPassword);
        if (!ok) {
            return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 400 });
        }
    }

    const hashed = await argon2.hash(newPassword);
    await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed },
    });

    return NextResponse.json({ ok: true });
}
