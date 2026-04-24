/**
 * Seed puntual: crea/actualiza el user de pruebas de Jonatan como admin.
 * Reruneable — hace upsert por email.
 */

import argon2 from "argon2";
import { prisma } from "../../src/lib/prisma";

const EMAIL = "jonatanvilella@gmail.com";
const NAME = "Jonatan Vilella";
const PASSWORD = "Admin$123456";
const ROLE_NAME = "admin";

async function seedTestAdmin() {
    try {
        console.log(`👤 Upserting test admin: ${EMAIL}`);

        const role = await prisma.role.findUnique({ where: { name: ROLE_NAME } });
        if (!role) {
            throw new Error(
                `Rol "${ROLE_NAME}" no existe. Corré primero roles-permissions.ts.`,
            );
        }

        const hashedPassword = await argon2.hash(PASSWORD);

        const user = await prisma.user.upsert({
            where: { email: EMAIL },
            update: {
                name: NAME,
                password: hashedPassword,
                roleId: role.id,
                isActive: true,
            },
            create: {
                email: EMAIL,
                name: NAME,
                password: hashedPassword,
                roleId: role.id,
                isActive: true,
            },
            include: { role: true },
        });

        console.log("\n✅ Test admin listo:");
        console.log(`   Nombre:   ${user.name}`);
        console.log(`   Email:    ${user.email}`);
        console.log(`   Rol:      ${user.role?.name}`);
        console.log(`   Password: ${PASSWORD}`);
        console.log(`   Activo:   ${user.isActive}`);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        console.log("\n🔌 Disconnected");
    }
}

seedTestAdmin();
