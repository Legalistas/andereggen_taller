/**
 * Asigna un rol a un usuario por email.
 * Útil después de re-correr el seed de roles (que deja a todos sin rol).
 *
 * Uso:
 *   bunx tsx prisma/seed/assign-role.ts <email> <roleName>
 *   bunx tsx prisma/seed/assign-role.ts legalistas.web@gmail.com super_admin
 */

import { prisma } from "../../src/lib/prisma";

async function main() {
  const [, , email, roleName] = process.argv;

  if (!email || !roleName) {
    console.error("Uso: bunx tsx prisma/seed/assign-role.ts <email> <roleName>");
    process.exit(1);
  }

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    console.error(`❌ Rol "${roleName}" no existe.`);
    const all = await prisma.role.findMany({ select: { name: true, label: true } });
    console.log("Roles disponibles:");
    for (const r of all) console.log(`  - ${r.name} (${r.label})`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`❌ Usuario con email "${email}" no existe.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { roleId: role.id, isActive: true },
  });

  console.log(`✅ ${email} ahora tiene rol "${roleName}" (${role.label}).`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
