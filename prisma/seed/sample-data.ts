import { prisma } from "../../src/lib/prisma";

async function seedDatabase() {
  try {
    console.log("🌱 Creando datos de prueba...");
    
    // Crear algunos roles
    const adminRole = await prisma.role.create({
      data: {
        name: "admin"
      }
    });
    
    const userRole = await prisma.role.create({
      data: {
        name: "user"
      }
    });
    
    const moderatorRole = await prisma.role.create({
      data: {
        name: "moderator"
      }
    });
    
    console.log("✅ Roles creados:", { adminRole, userRole, moderatorRole });
    
    // Crear algunos permisos
    const permissions = await Promise.all([
      prisma.permission.create({
        data: {
          name: "read_users",
          description: "Leer usuarios"
        }
      }),
      prisma.permission.create({
        data: {
          name: "write_users",
          description: "Escribir usuarios"
        }
      }),
      prisma.permission.create({
        data: {
          name: "delete_users",
          description: "Eliminar usuarios"
        }
      }),
      prisma.permission.create({
        data: {
          name: "manage_roles",
          description: "Gestionar roles"
        }
      })
    ]);
    
    console.log("✅ Permisos creados:", permissions.length);
    
    // Asignar permisos a roles
    await prisma.rolePermission.createMany({
      data: [
        // Admin tiene todos los permisos
        { roleId: adminRole.id, permissionId: permissions[0].id },
        { roleId: adminRole.id, permissionId: permissions[1].id },
        { roleId: adminRole.id, permissionId: permissions[2].id },
        { roleId: adminRole.id, permissionId: permissions[3].id },
        
        // Moderator tiene lectura y escritura
        { roleId: moderatorRole.id, permissionId: permissions[0].id },
        { roleId: moderatorRole.id, permissionId: permissions[1].id },
        
        // User solo lectura
        { roleId: userRole.id, permissionId: permissions[0].id }
      ]
    });
    
    console.log("✅ Permisos asignados a roles");
    
    // Crear algunos usuarios
    const users = await Promise.all([
      prisma.user.create({
        data: {
          name: "Admin User",
          email: "admin@example.com",
          roleId: adminRole.id
        }
      }),
      prisma.user.create({
        data: {
          name: "Regular User",
          email: "user@example.com", 
          roleId: userRole.id
        }
      }),
      prisma.user.create({
        data: {
          name: "Moderator User",
          email: "moderator@example.com",
          roleId: moderatorRole.id
        }
      })
    ]);
    
    console.log("✅ Usuarios creados:", users.length);
    
    // Mostrar el resultado final
    console.log("\n📊 Datos creados exitosamente:");
    const result = await prisma.user.findMany({
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });
    
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedDatabase();