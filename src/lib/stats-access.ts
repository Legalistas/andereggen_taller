import { getServerSession, verifyAuth } from "./auth-utils";
import { prisma } from "./prisma";
import { FINANCE_ROLES } from "./roles";

/**
 * Quién entra a Estadísticas (KPIs + reportes): rol de finanzas, o cualquier
 * rol interno con `User.canViewStats`.
 */
export async function canViewStats(
  userId: string,
  roleName: string | null | undefined,
): Promise<boolean> {
  if (roleName && (FINANCE_ROLES as readonly string[]).includes(roleName)) {
    return true;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { canViewStats: true },
  });
  return user?.canViewStats ?? false;
}

/** Guard de los endpoints de Estadísticas: null si pasa, la respuesta de error si no. */
export async function verifyStatsAccess(
  request: Request,
): Promise<Response | null> {
  const err = await verifyAuth(request);
  if (err) return err;
  const session = await getServerSession();
  const ok = await canViewStats(
    session?.user?.id ?? "",
    session?.user?.domainRole?.name,
  );
  return ok ? null : Response.json({ error: "Access denied" }, { status: 403 });
}
