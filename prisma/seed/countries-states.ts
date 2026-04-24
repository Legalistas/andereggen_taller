import { prisma } from "../../src/lib/prisma";

async function seedCountriesAndStates() {
  try {
    console.log("🌍 Creating countries and states...");

    // Crear Argentina como país por defecto
    const argentina = await prisma.country.upsert({
      where: { code: "AR" },
      update: {},
      create: {
        name: "Argentina",
        code: "AR"
      }
    });

    console.log("✅ Argentina created:", argentina.name);

    // Provincias de Argentina
    const argentineStates = [
      "Buenos Aires",
      "Catamarca", 
      "Chaco",
      "Chubut",
      "Córdoba",
      "Corrientes",
      "Entre Ríos",
      "Formosa",
      "Jujuy",
      "La Pampa",
      "La Rioja",
      "Mendoza",
      "Misiones",
      "Neuquén",
      "Río Negro",
      "Salta",
      "San Juan",
      "San Luis",
      "Santa Cruz",
      "Santa Fe",
      "Santiago del Estero",
      "Tierra del Fuego",
      "Tucumán",
      "Ciudad Autónoma de Buenos Aires"
    ];

    console.log("🏛️ Creating Argentine states...");

    for (const stateName of argentineStates) {
      await prisma.state.upsert({
        where: {
          name_countryId: {
            name: stateName,
            countryId: argentina.id
          }
        },
        update: {},
        create: {
          name: stateName,
          countryId: argentina.id
        }
      });
    }

    console.log("✅ States created:", argentineStates.length);

    // Mostrar resumen
    const countries = await prisma.country.findMany({
      include: {
        states: true
      }
    });

    console.log("\n📊 Summary:");
    countries.forEach(country => {
      console.log(`🌍 ${country.name} (${country.code}): ${country.states.length} states`);
    });

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
    console.log("\n🔌 Disconnected from database");
  }
}

seedCountriesAndStates();