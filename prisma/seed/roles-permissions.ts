import { prisma } from "../../src/lib/prisma";

async function seedRolesAndPermissions() {
  try {
    console.log("🌱 Creating roles and permissions...");

    // Clean existing data
    console.log("🧹 Cleaning existing data...");
    await prisma.rolePermission.deleteMany({});
    await prisma.user.updateMany({
      data: { roleId: null }
    });
    await prisma.customer.updateMany({
      data: { roleId: null }
    });
    await prisma.permission.deleteMany({});
    await prisma.role.deleteMany({});
    
    console.log("✅ Existing data cleaned");

    // Create permissions for users
    console.log("📋 Creating user permissions...");
    const permissions = await Promise.all([
      prisma.permission.create({
        data: {
          name: "view_users",
          description: "View users"
        }
      }),
      prisma.permission.create({
        data: {
          name: "create_users",
          description: "Create users"
        }
      }),
      prisma.permission.create({
        data: {
          name: "edit_users",
          description: "Edit users"
        }
      }),
      prisma.permission.create({
        data: {
          name: "delete_users",
          description: "Delete users"
        }
      }),
      prisma.permission.create({
        data: {
          name: "disable_users",
          description: "Disable users"
        }
      })
    ]);

    console.log("✅ Permissions created:", permissions.map(p => p.name));

    // Create roles
    console.log("🔐 Creating roles...");
    const adminRole = await prisma.role.create({
      data: {
        name: "admin"
      }
    });

    const internalRole = await prisma.role.create({
      data: {
        name: "internal"
      }
    });

    const customerRole = await prisma.role.create({
      data: {
        name: "customer"
      }
    });

    const managerRole = await prisma.role.create({
      data: {
        name: "manager"
      }
    });

    const mechanicRole = await prisma.role.create({
      data: {
        name: "mechanic"
      }
    });

    const receptionistRole = await prisma.role.create({
      data: {
        name: "receptionist"
      }
    });

    const qualityControlRole = await prisma.role.create({
      data: {
        name: "quality_control"
      }
    });

    console.log("✅ Roles created:", [
      adminRole.name, 
      internalRole.name, 
      customerRole.name,
      managerRole.name,
      mechanicRole.name,
      receptionistRole.name,
      qualityControlRole.name
    ]);

    // Assign permissions to roles
    console.log("🔗 Assigning permissions to roles...");

    // Admin: All permissions
    await prisma.rolePermission.createMany({
      data: permissions.map(permission => ({
        roleId: adminRole.id,
        permissionId: permission.id
      }))
    });

    // Internal: view, create, edit, disable (no delete)
    const internalPermissions = permissions.filter(p => 
      ['view_users', 'create_users', 'edit_users', 'disable_users'].includes(p.name)
    );
    await prisma.rolePermission.createMany({
      data: internalPermissions.map(permission => ({
        roleId: internalRole.id,
        permissionId: permission.id
      }))
    });

    // Customer: no permissions (registration only role)
    console.log("   - Customer: no permissions (registration only)");

    // Manager: All permissions (same as admin)
    await prisma.rolePermission.createMany({
      data: permissions.map(permission => ({
        roleId: managerRole.id,
        permissionId: permission.id
      }))
    });
    console.log("   - Manager: all permissions");

    // Mechanic: view users only
    const mechanicPermissions = permissions.filter(p => ['view_users'].includes(p.name));
    await prisma.rolePermission.createMany({
      data: mechanicPermissions.map(permission => ({
        roleId: mechanicRole.id,
        permissionId: permission.id
      }))
    });
    console.log("   - Mechanic: view users");

    // Receptionist: view, create, edit users
    const receptionistPermissions = permissions.filter(p => 
      ['view_users', 'create_users', 'edit_users'].includes(p.name)
    );
    await prisma.rolePermission.createMany({
      data: receptionistPermissions.map(permission => ({
        roleId: receptionistRole.id,
        permissionId: permission.id
      }))
    });
    console.log("   - Receptionist: view, create, edit users");

    // Quality Control: view, edit users
    const qualityControlPermissions = permissions.filter(p => 
      ['view_users', 'edit_users'].includes(p.name)
    );
    await prisma.rolePermission.createMany({
      data: qualityControlPermissions.map(permission => ({
        roleId: qualityControlRole.id,
        permissionId: permission.id
      }))
    });
    console.log("   - Quality Control: view, edit users");

    console.log("✅ Permissions assigned successfully");

    // Display final result
    console.log("\n📊 Final structure:");
    const rolesWithPermissions = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    rolesWithPermissions.forEach(role => {
      console.log(`\n🔑 Role: ${role.name.toUpperCase()}`);
      console.log("   Permissions:");
      role.permissions.forEach(rp => {
        console.log(`   - ${rp.permission.name} (${rp.permission.description})`);
      });
    });

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
    console.log("\n🔌 Disconnected from database");
  }
}

seedRolesAndPermissions();