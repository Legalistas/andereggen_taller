// Example usage of the Can utility in different scenarios

import { can } from "@/lib/can";
import { auth } from "@/auth";

// Example 1: In a Server Component
export async function UserActionsComponent() {
  const session = await auth();
  const userCan = can(session);

  if (!userCan.viewUsers) {
    return <div>You don't have permission to view users</div>;
  }

  return (
    <div className="space-y-4">
      <h2>User Actions</h2>
      
      {userCan.createUsers && (
        <button>Create New User</button>
      )}
      
      {userCan.editUsers && (
        <button>Edit User</button>
      )}
      
      {userCan.deleteUsers && (
        <button>Delete User</button>
      )}
      
      {userCan.disableUsers && (
        <button>Disable User</button>
      )}
    </div>
  );
}

// Example 2: Conditional rendering based on roles
export function AdminPanel({ session }: { session: any }) {
  const userCan = can(session);

  return (
    <div>
      {userCan.isAdmin && (
        <div className="admin-panel">
          <h2>Admin Panel</h2>
          {/* Admin only content */}
        </div>
      )}
      
      {userCan.isInternal && (
        <div className="internal-panel">
          <h2>Internal Tools</h2>
          {/* Internal user content */}
        </div>
      )}
      
      {userCan.isAdminOrInternal && (
        <div className="shared-tools">
          <h2>Shared Tools</h2>
          {/* Content for both admin and internal */}
        </div>
      )}
    </div>
  );
}

// Example 3: Using combined permissions
export function UserManagement({ session }: { session: any }) {
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
            {/* Show all user management options */}
          </div>
        ) : (
          <div>
            <p>Limited user management access</p>
            {/* Show limited options */}
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
export function CustomPermissionCheck({ session }: { session: any }) {
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
  CustomPermissionCheck
};