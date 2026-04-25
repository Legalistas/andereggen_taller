// Edge-compatible helpers — NO imports de prisma ni better-auth server.
// Se usan en componentes cliente y en el middleware (runtime edge).

export interface DomainRole {
  id: string;
  name: string;
  label?: string; // display name en español ("Super Admin", "Administrativo del Taller", …)
  type?: "INTERNAL" | "EXTERNAL";
  permissions: Array<{
    permission: {
      name: string;
      description: string;
    };
  }>;
}

/**
 * Fallback de labels para los roles base del sistema — útil en componentes
 * que solo tienen el `name` (ej: listados desde /api/users) y no pasan
 * por el customSession que ya expone `label`.
 */
const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin_taller: "Administrativo del Taller",
  contable: "Contable",
  cliente: "Cliente",
  inspector: "Inspector / Perito",
  productor_seguros: "Productor de Seguros",
  compania_seguros: "Compañía de Seguros",
};

export function roleLabel(name: string | null | undefined): string {
  if (!name) return "—";
  return ROLE_LABELS[name] ?? name;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified?: boolean;
  banned?: boolean | null;
  isActive?: boolean;
  role?: string | null; // better-auth admin role string
  domainRole?: DomainRole | null; // custom Role con permisos
  twoFactorEnabled?: boolean;
}

export interface AppSessionLike {
  user: AppUser;
  session: { id: string; userId: string; expiresAt: Date | string };
}

export function hasPermissionEdge(
  session: AppSessionLike | null | undefined,
  permission: string,
): boolean {
  const perms = session?.user?.domainRole?.permissions;
  if (!perms) return false;
  return perms.some((p) => p.permission.name === permission);
}

export const INTERNAL_ROLES_EDGE = [
  "super_admin",
  "admin_taller",
  "contable",
] as const;

export const ADMIN_ROLES_EDGE = ["super_admin", "admin_taller"] as const;

export function isSuperAdminEdge(
  session: AppSessionLike | null | undefined,
): boolean {
  return session?.user?.domainRole?.name === "super_admin";
}

/** true para super_admin o admin_taller. */
export function isAdminEdge(
  session: AppSessionLike | null | undefined,
): boolean {
  const name = session?.user?.domainRole?.name;
  return !!name && (ADMIN_ROLES_EDGE as readonly string[]).includes(name);
}

/** true para cualquier rol interno (super_admin, admin_taller, contable). */
export function isInternalEdge(
  session: AppSessionLike | null | undefined,
): boolean {
  const name = session?.user?.domainRole?.name;
  return !!name && (INTERNAL_ROLES_EDGE as readonly string[]).includes(name);
}

/** @deprecated Mismo significado que isInternalEdge ahora. */
export function isAdminOrInternalEdge(
  session: AppSessionLike | null | undefined,
): boolean {
  return isInternalEdge(session);
}

export function getUserPermissionsEdge(
  session: AppSessionLike | null | undefined,
): string[] {
  const perms = session?.user?.domainRole?.permissions;
  if (!perms) return [];
  return perms.map((p) => p.permission.name);
}

export function isValidSessionEdge(
  session: AppSessionLike | null | undefined,
): boolean {
  return !!(
    session?.user?.id &&
    session?.user?.email &&
    session.user.isActive !== false &&
    !session.user.banned
  );
}

export function getRoleInfoEdge(session: AppSessionLike | null | undefined) {
  return {
    id: session?.user?.domainRole?.id,
    name: session?.user?.domainRole?.name,
    permissions: getUserPermissionsEdge(session),
  };
}
