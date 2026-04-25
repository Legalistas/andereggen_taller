// Example usage of the Can utility in different scenarios

import type { AppSessionLike } from "@/lib/auth-edge";
import { getServerSession } from "@/lib/auth-utils";
import { can } from "@/lib/can";

// Example 1: In a Server Component
export async function UserActionsComponent() {
  const session = await getServerSession();
  const userCan = can(session as unknown as AppSessionLike);

  if (!userCan.viewUsers) {
    return <div>You don&apos;t have permission to view users</div>;
  }

  return (
    <div className="space-y-4">
      <h2>User Actions</h2>

      {userCan.createUsers && <button type="button">Create New User</button>}

      {userCan.editUsers && <button type="button">Edit User</button>}

      {userCan.deleteUsers && <button type="button">Delete User</button>}

      {userCan.disableUsers && <button type="button">Disable User</button>}
    </div>
  );
}

// Example 2: Conditional rendering based on roles
export function AdminPanel({ session }: { session: AppSessionLike }) {
  const userCan = can(session);

  return (
    <div>
      {userCan.isAdmin && (
        <div className="admin-panel">
          <h2>Admin Panel</h2>
        </div>
      )}

      {userCan.isInternal && (
        <div className="internal-panel">
          <h2>Internal Tools</h2>
        </div>
      )}

      {userCan.isAdminOrInternal && (
        <div className="shared-tools">
          <h2>Shared Tools</h2>
        </div>
      )}
    </div>
  );
}

// Example 3: Using combined permissions
export function UserManagement({ session }: { session: AppSessionLike }) {
  const userCan = can(session);

  if (!userCan.manageUsers) {
    return (
      <div className="error-state">
        <h2>Access Denied</h2>
        <p>You need user management permissions to access this section.</p>
      </div>
    );
  }

  return (
    <div className="user-management">
      <h1>User Management</h1>

      <div className="actions">
        {userCan.fullUserAccess ? (
          <div>
            <p>You have full access to user management</p>
          </div>
        ) : (
          <div>
            <p>Limited user management access</p>
          </div>
        )}
      </div>

      <div className="user-info">
        <h3>Your Role: {userCan.role.name}</h3>
        <p>Permissions: {userCan.permissions.join(", ")}</p>
      </div>
    </div>
  );
}

// Example 4: Custom permission check
export function CustomPermissionCheck({
  session,
}: {
  session: AppSessionLike;
}) {
  const userCan = can(session);

  return (
    <div>
      {userCan.permission("custom_permission") && (
        <div>Custom permission granted!</div>
      )}
    </div>
  );
}

export default {
  UserActionsComponent,
  AdminPanel,
  UserManagement,
  CustomPermissionCheck,
};
