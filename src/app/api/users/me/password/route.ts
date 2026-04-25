import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/auth-utils";

/**
 * PATCH /api/users/me/password
 * Body: { currentPassword?, newPassword }
 *
 * Reenvía al flujo nativo de better-auth (auth.api.changePassword),
 * que maneja hash, validación de la contraseña actual y revocación opcional
 * de otras sesiones.
 */
export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword =
    (body as { currentPassword?: string })?.currentPassword ?? "";
  const newPassword = (body as { newPassword?: string })?.newPassword ?? "";
  const revokeOtherSessions = Boolean(
    (body as { revokeOtherSessions?: boolean })?.revokeOtherSessions,
  );

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json(
      { error: "La contraseña nueva debe tener al menos 8 caracteres" },
      { status: 400 },
    );
  }

  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo cambiar la contraseña";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
