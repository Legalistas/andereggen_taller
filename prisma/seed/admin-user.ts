import { prisma } from "../../src/lib/prisma";
import argon2 from "argon2";

async function seedAdminUser() {
  try {
    console.log("👤 Creating admin user...");

    // Hash the password using argon2
    const hashedPassword = await argon2.hash("Admin$123456");

    // Get admin role
    const adminRole = await prisma.role.findUnique({
      where: { name: "admin" }
    });

    if (!adminRole) {
      throw new Error("Admin role not found. Please run roles and permissions seed first.");
    }

    // Check if admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: "admin@example.com" }
    });

    if (existingUser) {
      console.log("⚠️  Admin user already exists, updating...");
      
      const updatedUser = await prisma.user.update({
        where: { email: "admin@example.com" },
        data: {
          name: "John Doe",
          password: hashedPassword,
          roleId: adminRole.id,
          isActive: true
        },
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

      console.log("✅ Admin user updated:", {
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role?.name,
        permissions: updatedUser.role?.permissions.length
      });

    } else {
      console.log("🆕 Creating new admin user...");
      
      const newUser = await prisma.user.create({
        data: {
          name: "John Doe",
          email: "admin@example.com",
          password: hashedPassword,
          roleId: adminRole.id,
          isActive: true
        },
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

      console.log("✅ Admin user created:", {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role?.name,
        permissions: newUser.role?.permissions.length
      });
    }

    console.log("\n📋 Admin user details:");
    console.log("   Name: John Doe");
    console.log("   Email: admin@example.com");
    console.log("   Password: Admin$123456");
    console.log("   Role: admin");
    console.log("   Status: active");

  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  } finally {
    await prisma.$disconnect();
    console.log("\n🔌 Disconnected from database");
  }
}

seedAdminUser();