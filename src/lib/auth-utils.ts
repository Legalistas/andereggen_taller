import { auth } from "../auth";
import { redirect } from "next/navigation";

/**
 * Higher-order function to protect routes
 */
export async function protectRoute(allowedRoles: string[] = ["admin", "internal"]) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (!session.user.isActive) {
    redirect("/auth/error?error=AccountInactive");
  }

  if (!session.user.role || !allowedRoles.includes(session.user.role.name)) {
    redirect("/auth/error?error=AccessDenied");
  }

  return session;
}

/**
 * Check if user has specific permission
 */
export function hasPermission(session: any, permission: string): boolean {
  if (!session?.user?.role?.permissions) {
    return false;
  }

  return session.user.role.permissions.some(
    (p: any) => p.permission.name === permission
  );
}

/**
 * Check if user has admin role
 */
export function isAdmin(session: any): boolean {
  return session?.user?.role?.name === "admin";
}

/**
 * Check if user has internal role
 */
export function isInternal(session: any): boolean {
  return session?.user?.role?.name === "internal";
}

/**
 * Get user permissions as array of strings
 */
export function getUserPermissions(session: any): string[] {
  if (!session?.user?.role?.permissions) {
    return [];
  }

  return session.user.role.permissions.map((p: any) => p.permission.name);
}

/**
 * Component-level permission check
 */
export function requirePermission(permission: string) {
  return function <T extends any[]>(target: (...args: T) => any) {
    return async function (...args: T) {
      const session = await auth();
      
      if (!session?.user) {
        redirect("/auth/signin");
      }

      if (!hasPermission(session, permission)) {
        redirect("/auth/error?error=InsufficientPermissions");
      }

      return target(...args);
    };
  };
}

/**
 * Middleware helper for API routes
 */
export async function verifyAuth(request: Request, allowedRoles: string[] = ["admin", "internal"]) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.user.isActive) {
    return Response.json({ error: "Account inactive" }, { status: 403 });
  }

  if (!session.user.role || !allowedRoles.includes(session.user.role.name)) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  return null; // No error, auth passed
}

/**
 * Role-based route protection
 */
export const roleGuards = {
  adminOnly: () => protectRoute(["admin"]),
  adminAndInternal: () => protectRoute(["admin", "internal"]),
  internalOnly: () => protectRoute(["internal"])
};

/**
 * Permission-based route protection
 */
export const permissionGuards = {
  viewUsers: async () => {
    const session = await protectRoute();
    if (!hasPermission(session, "view_users")) {
      redirect("/auth/error?error=InsufficientPermissions");
    }
    return session;
  },
  createUsers: async () => {
    const session = await protectRoute();
    if (!hasPermission(session, "create_users")) {
      redirect("/auth/error?error=InsufficientPermissions");
    }
    return session;
  },
  editUsers: async () => {
    const session = await protectRoute();
    if (!hasPermission(session, "edit_users")) {
      redirect("/auth/error?error=InsufficientPermissions");
    }
    return session;
  },
  deleteUsers: async () => {
    const session = await protectRoute();
    if (!hasPermission(session, "delete_users")) {
      redirect("/auth/error?error=InsufficientPermissions");
    }
    return session;
  },
  disableUsers: async () => {
    const session = await protectRoute();
    if (!hasPermission(session, "disable_users")) {
      redirect("/auth/error?error=InsufficientPermissions");
    }
    return session;
  }
};