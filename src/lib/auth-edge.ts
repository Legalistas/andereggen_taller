// Edge-compatible utilities for authentication checks
// This file contains only functions that can run in the Edge Runtime

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: {
    id: string;
    name: string;
    permissions: Array<{
      permission: {
        name: string;
        description: string;
      };
    }>;
  } | null;
  isActive: boolean;
}

/**
 * Check if user has specific permission (edge-compatible)
 */
export function hasPermissionEdge(session: any, permission: string): boolean {
  if (!session?.user?.role?.permissions) {
    return false;
  }

  return session.user.role.permissions.some(
    (p: any) => p.permission.name === permission
  );
}

/**
 * Check if user has admin role (edge-compatible)
 */
export function isAdminEdge(session: any): boolean {
  return session?.user?.role?.name === "admin";
}

/**
 * Check if user has internal role (edge-compatible)
 */
export function isInternalEdge(session: any): boolean {
  return session?.user?.role?.name === "internal";
}

/**
 * Check if user has admin or internal role (edge-compatible)
 */
export function isAdminOrInternalEdge(session: any): boolean {
  const roleName = session?.user?.role?.name;
  return roleName === "admin" || roleName === "internal";
}

/**
 * Get user permissions as array of strings (edge-compatible)
 */
export function getUserPermissionsEdge(session: any): string[] {
  if (!session?.user?.role?.permissions) {
    return [];
  }

  return session.user.role.permissions.map((p: any) => p.permission.name);
}

/**
 * Check if session is valid and user is active (edge-compatible)
 */
export function isValidSessionEdge(session: any): boolean {
  return !!(
    session?.user?.id &&
    session?.user?.email &&
    session?.user?.isActive !== false
  );
}

/**
 * Extract role information from session (edge-compatible)
 */
export function getRoleInfoEdge(session: any) {
  return {
    id: session?.user?.role?.id,
    name: session?.user?.role?.name,
    permissions: getUserPermissionsEdge(session)
  };
}