import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export type AppSession = Awaited<ReturnType<typeof auth.api.getSession>>;

/**
 * Roles con acceso al backoffice interno del taller.
 * Los roles externos (cliente, inspector, productor_seguros, compania_seguros)
 * no acceden al dashboard principal.
 */
export const INTERNAL_ROLES = [
  "super_admin",
  "admin_taller",
  "contable",
] as const;

/**
 * Roles con capacidad de administrar el sistema (super_admin + admin_taller).
 * Usado para endpoints que antes requerían el rol "admin" legacy.
 */
export const ADMIN_ROLES = ["super_admin", "admin_taller"] as const;

/**
 * Obtiene la sesión del request actual. Server-only.
 */
export async function getServerSession(): Promise<AppSession> {
  return auth.api.getSession({
    headers: await headers(),
  });
}

/**
 * Higher-order para proteger server components / pages.
 * Redirige a signin si no hay sesión, a error si el usuario no tiene uno de los
 * roles permitidos. Default: todos los roles internos.
 */
export async function protectRoute(
  allowedRoles: readonly string[] = INTERNAL_ROLES,
) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.banned) {
    redirect("/auth/error?error=AccountBanned");
  }

  if (session.user.isActive === false) {
    redirect("/auth/error?error=AccountInactive");
  }

  const roleName = session.user.domainRole?.name;
  if (!roleName || !allowedRoles.includes(roleName)) {
    redirect("/auth/error?error=AccessDenied");
  }

  return session;
}

/**
 * Devuelve true si la sesión tiene el permiso dado.
 * El super_admin tiene acceso total — `full_system_access` es su permiso distintivo.
 */
export function hasPermission(
  session: AppSession,
  permission: string,
): boolean {
  const perms = session?.user?.domainRole?.permissions;
  if (!perms) return false;
  if (perms.some((p) => p.permission.name === "full_system_access")) return true;
  return perms.some((p) => p.permission.name === permission);
}

export function isSuperAdmin(session: AppSession): boolean {
  return session?.user?.domainRole?.name === "super_admin";
}

export function isAdminTaller(session: AppSession): boolean {
  return session?.user?.domainRole?.name === "admin_taller";
}

export function isContable(session: AppSession): boolean {
  return session?.user?.domainRole?.name === "contable";
}

/**
 * @deprecated Usar isSuperAdmin() o chequear ADMIN_ROLES.
 * Alias: true para super_admin o admin_taller.
 */
export function isAdmin(session: AppSession): boolean {
  const name = session?.user?.domainRole?.name;
  return !!name && (ADMIN_ROLES as readonly string[]).includes(name);
}

/**
 * @deprecated Usar isContable() o chequear INTERNAL_ROLES.
 * Alias: true para cualquier rol interno (super_admin, admin_taller, contable).
 */
export function isInternal(session: AppSession): boolean {
  const name = session?.user?.domainRole?.name;
  return !!name && (INTERNAL_ROLES as readonly string[]).includes(name);
}

export function getUserPermissions(session: AppSession): string[] {
  const perms = session?.user?.domainRole?.permissions;
  if (!perms) return [];
  return perms.map((p) => p.permission.name);
}

/**
 * Helper para API routes. Devuelve null si la auth pasa, o una Response de error.
 * Pensado para el patrón: `const err = await verifyAuth(req); if (err) return err;`.
 */
export async function verifyAuth(
  _request: Request,
  allowedRoles: readonly string[] = INTERNAL_ROLES,
): Promise<Response | null> {
  const session = await getServerSession();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.banned) {
    return Response.json({ error: "Account banned" }, { status: 403 });
  }

  if (session.user.isActive === false) {
    return Response.json({ error: "Account inactive" }, { status: 403 });
  }

  const roleName = session.user.domainRole?.name;
  if (!roleName || !allowedRoles.includes(roleName)) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  return null;
}

export const roleGuards = {
  superAdminOnly: () => protectRoute(["super_admin"]),
  adminTaller: () => protectRoute(["super_admin", "admin_taller"]),
  internal: () => protectRoute(INTERNAL_ROLES),
};

export const permissionGuards = {
  viewUsers: async () => {
    const session = await protectRoute();
    if (!hasPermission(session, "view_users"))
      redirect("/auth/error?error=InsufficientPermissions");
    return session;
  },
  createUsers: async () => {
    const session = await protectRoute();
    if (!hasPermission(session, "create_users"))
      redirect("/auth/error?error=InsufficientPermissions");
    return session;
  },
  editUsers: async () => {
    const session = await protectRoute();
    if (!hasPermission(session, "edit_users"))
      redirect("/auth/error?error=InsufficientPermissions");
    return session;
  },
  deleteUsers: async () => {
    const session = await protectRoute();
    if (!hasPermission(session, "delete_users"))
      redirect("/auth/error?error=InsufficientPermissions");
    return session;
  },
  disableUsers: async () => {
    const session = await protectRoute();
    if (!hasPermission(session, "disable_users"))
      redirect("/auth/error?error=InsufficientPermissions");
    return session;
  },
};
