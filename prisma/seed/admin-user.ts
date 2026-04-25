import "dotenv/config";
import { auth } from "../../src/lib/auth";
import { prisma } from "../../src/lib/prisma";

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL ?? "admin@andereggen.ar";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? "Admin$123456";
const ADMIN_NAME = process.env.ADMIN_SEED_NAME ?? "Super Admin";

/**
 * Crea el primer usuario super_admin usando el flujo de better-auth
 * (hashea la password con scrypt y crea el Account correctamente).
 * Idempotente: si el email ya existe, solo lo actualiza (reasigna rol,
 * marca emailVerified, no toca la password para no romper logins previos).
 */
async function seedAdminUser() {
  try {
    const superAdminRole = await prisma.role.findUnique({
      where: { name: "super_admin" },
    });
    if (!superAdminRole) {
      throw new Error(
        "El rol super_admin no existe. Correr primero `roles-permissions.ts`.",
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (existing) {
      console.log(`  Usuario ${ADMIN_EMAIL} ya existe — actualizando rol + emailVerified.`);
      await prisma.user.update({
        where: { email: ADMIN_EMAIL },
        data: {
          name: ADMIN_NAME,
          roleId: superAdminRole.id,
          emailVerified: true,
          adminRole: "admin", // rol del plugin admin de better-auth
          isActive: true,
          banned: false,
        },
      });
      console.log(`  Listo: ${ADMIN_EMAIL} con rol super_admin.`);
      return;
    }

    console.log(`  Creando usuario super_admin: ${ADMIN_EMAIL}`);
    await auth.api.signUpEmail({
      body: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        name: ADMIN_NAME,
      },
      asResponse: false,
    });

    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: {
        roleId: superAdminRole.id,
        emailVerified: true,
        adminRole: "admin",
      },
    });

    console.log(`  Usuario creado — email: ${ADMIN_EMAIL}, password: ${ADMIN_PASSWORD}`);
    console.log("  Cambiá la password apenas puedas.");
  } catch (error) {
    console.error("Error creando admin user:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdminUser();
