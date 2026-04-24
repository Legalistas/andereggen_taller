import { prisma } from "../../src/lib/prisma";

async function testConnection() {
  try {
    console.log("🔍 Testeando conexión a la base de datos...");
    
    // Test basic connection
    await prisma.$connect();
    console.log("✅ Conexión exitosa!");
    
    // Test raw query to see tables
    console.log("\n📊 Consultando tablas existentes...");
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
    console.log("Tablas encontradas:", tables);
    
    // Test User table (if exists)
    console.log("\n👥 Consultando tabla User...");
    const userCount = await prisma.user.count();
    console.log(`Número de usuarios: ${userCount}`);
    
    // Test Role table (if exists)
    console.log("\n🔐 Consultando tabla Role...");
    const roleCount = await prisma.role.count();
    console.log(`Número de roles: ${roleCount}`);
    
    // Show all users with their roles
    if (userCount > 0) {
      console.log("\n👤 Usuarios existentes:");
      const users = await prisma.user.findMany({
        include: {
          role: true
        }
      });
      console.log(JSON.stringify(users, null, 2));
    }
    
    // Show all roles
    if (roleCount > 0) {
      console.log("\n🔑 Roles existentes:");
      const roles = await prisma.role.findMany({
        include: {
          users: true,
          permissions: {
            include: {
              permission: true
            }
          }
        }
      });
      console.log(JSON.stringify(roles, null, 2));
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
    console.log("\n🔌 Desconectado de la base de datos");
  }
}

testConnection();