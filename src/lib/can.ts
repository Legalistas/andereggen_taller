import type { AppSessionLike } from "./auth-edge";
import { hasPermission, isAdmin, isInternal } from "./auth-utils";

type SessionInput = AppSessionLike | null | undefined;

/**
 * Permission checker utilities
 * Centralized place for all permission validations
 */
export class Can {
  private session: SessionInput;

  constructor(session: SessionInput) {
    this.session = session;
  }

  // Role checks
  get isAdmin() {
    return isAdmin(this.session as never);
  }

  get isInternal() {
    return isInternal(this.session as never);
  }

  get isAdminOrInternal() {
    return this.isAdmin || this.isInternal;
  }

  // User permissions
  get viewUsers() {
    return hasPermission(this.session as never, "view_users");
  }

  get createUsers() {
    return hasPermission(this.session as never, "create_users");
  }

  get editUsers() {
    return hasPermission(this.session as never, "edit_users");
  }

  get deleteUsers() {
    return hasPermission(this.session as never, "delete_users");
  }

  get disableUsers() {
    return hasPermission(this.session as never, "disable_users");
  }

  // Combined permissions
  get manageUsers() {
    return this.viewUsers && this.editUsers && this.createUsers;
  }

  get fullUserAccess() {
    return this.manageUsers && this.deleteUsers && this.disableUsers;
  }

  // Get all user permissions as array
  get permissions(): string[] {
    return (
      this.session?.user?.domainRole?.permissions?.map(
        (p) => p.permission.name,
      ) ?? []
    );
  }

  // Check custom permission
  permission(permissionName: string) {
    return hasPermission(this.session as never, permissionName);
  }

  // Get user info
  get user() {
    return {
      id: this.session?.user?.id,
      name: this.session?.user?.name,
      email: this.session?.user?.email,
      role: this.session?.user?.domainRole?.name,
      isActive: this.session?.user?.isActive,
    };
  }

  // Get role info
  get role() {
    return {
      id: this.session?.user?.domainRole?.id,
      name: this.session?.user?.domainRole?.name,
      permissions: this.permissions,
    };
  }
}

/**
 * Factory function to create Can instance
 */
export function can(session: SessionInput) {
  return new Can(session);
}

/**
 * Hook-like function for components
 */
export function useCan(session: SessionInput) {
  return can(session);
}
