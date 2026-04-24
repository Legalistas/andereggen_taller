import { hasPermission, isAdmin, isInternal } from "./auth-utils";

/**
 * Permission checker utilities
 * Centralized place for all permission validations
 */
export class Can {
  private session: any;

  constructor(session: any) {
    this.session = session;
  }

  // Role checks
  get isAdmin() {
    return isAdmin(this.session);
  }

  get isInternal() {
    return isInternal(this.session);
  }

  get isAdminOrInternal() {
    return this.isAdmin || this.isInternal;
  }

  // User permissions
  get viewUsers() {
    return hasPermission(this.session, "view_users");
  }

  get createUsers() {
    return hasPermission(this.session, "create_users");
  }

  get editUsers() {
    return hasPermission(this.session, "edit_users");
  }

  get deleteUsers() {
    return hasPermission(this.session, "delete_users");
  }

  get disableUsers() {
    return hasPermission(this.session, "disable_users");
  }

  // Combined permissions
  get manageUsers() {
    return this.viewUsers && this.editUsers && this.createUsers;
  }

  get fullUserAccess() {
    return this.manageUsers && this.deleteUsers && this.disableUsers;
  }

  // Get all user permissions as array
  get permissions() {
    return this.session?.user?.role?.permissions?.map((p: any) => p.permission.name) || [];
  }

  // Check custom permission
  permission(permissionName: string) {
    return hasPermission(this.session, permissionName);
  }

  // Get user info
  get user() {
    return {
      id: this.session?.user?.id,
      name: this.session?.user?.name,
      email: this.session?.user?.email,
      role: this.session?.user?.role?.name,
      isActive: this.session?.user?.isActive
    };
  }

  // Get role info
  get role() {
    return {
      id: this.session?.user?.role?.id,
      name: this.session?.user?.role?.name,
      permissions: this.permissions
    };
  }
}

/**
 * Factory function to create Can instance
 */
export function can(session: any) {
  return new Can(session);
}

/**
 * Hook-like function for components
 */
export function useCan(session: any) {
  return can(session);
}