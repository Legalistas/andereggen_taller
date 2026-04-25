/**
 * Seed del catálogo de marcas y modelos de vehículos.
 * Cubre las marcas más comunes del mercado argentino con sus modelos
 * principales. Idempotente (upsert).
 */

import { prisma } from "../../src/lib/prisma";

type BrandFixture = { name: string; models: string[] };

const FIXTURES: BrandFixture[] = [
  {
    name: "Toyota",
    models: [
      "Corolla",
      "Corolla Cross",
      "Etios",
      "Yaris",
      "Hilux",
      "SW4",
      "RAV4",
      "Camry",
      "Hiace",
    ],
  },
  {
    name: "Ford",
    models: [
      "Fiesta",
      "Focus",
      "Ka",
      "EcoSport",
      "Kuga",
      "Territory",
      "Ranger",
      "F-100",
      "Mondeo",
      "Bronco Sport",
    ],
  },
  {
    name: "Chevrolet",
    models: [
      "Onix",
      "Onix Plus",
      "Prisma",
      "Cruze",
      "Tracker",
      "Spin",
      "Captiva",
      "S10",
      "Montana",
      "Corsa",
      "Aveo",
    ],
  },
  {
    name: "Volkswagen",
    models: [
      "Gol",
      "Gol Trend",
      "Voyage",
      "Polo",
      "Virtus",
      "T-Cross",
      "Nivus",
      "Taos",
      "Tiguan",
      "Amarok",
      "Saveiro",
      "Vento",
      "Suran",
    ],
  },
  {
    name: "Fiat",
    models: [
      "Cronos",
      "Argo",
      "Mobi",
      "Pulse",
      "Fastback",
      "Toro",
      "Strada",
      "Uno",
      "Palio",
      "Siena",
      "500",
      "Ducato",
    ],
  },
  {
    name: "Renault",
    models: [
      "Kwid",
      "Logan",
      "Sandero",
      "Stepway",
      "Duster",
      "Kangoo",
      "Oroch",
      "Alaskan",
      "Koleos",
      "Captur",
      "Fluence",
      "Megane",
    ],
  },
  {
    name: "Peugeot",
    models: [
      "208",
      "2008",
      "3008",
      "5008",
      "308",
      "408",
      "Partner",
      "Expert",
      "Boxer",
      "Rifter",
    ],
  },
  {
    name: "Citroën",
    models: [
      "C3",
      "C3 Aircross",
      "C4 Cactus",
      "C4 Lounge",
      "C5 Aircross",
      "Berlingo",
      "Jumpy",
      "Jumper",
    ],
  },
  {
    name: "Honda",
    models: [
      "Civic",
      "Fit",
      "City",
      "HR-V",
      "CR-V",
      "WR-V",
      "Accord",
    ],
  },
  {
    name: "Nissan",
    models: [
      "Versa",
      "Sentra",
      "March",
      "Note",
      "Kicks",
      "X-Trail",
      "Frontier",
      "NP300",
    ],
  },
  {
    name: "Hyundai",
    models: [
      "HB20",
      "Accent",
      "Elantra",
      "i10",
      "i20",
      "Tucson",
      "Creta",
      "Santa Fe",
      "Kona",
      "HR",
    ],
  },
  {
    name: "Kia",
    models: [
      "Picanto",
      "Rio",
      "Cerato",
      "Stonic",
      "Seltos",
      "Sportage",
      "Sorento",
      "Carnival",
    ],
  },
  {
    name: "BMW",
    models: [
      "Serie 1",
      "Serie 2",
      "Serie 3",
      "Serie 4",
      "Serie 5",
      "X1",
      "X2",
      "X3",
      "X4",
      "X5",
      "Z4",
    ],
  },
  {
    name: "Mercedes-Benz",
    models: [
      "Clase A",
      "Clase B",
      "Clase C",
      "Clase E",
      "Clase S",
      "GLA",
      "GLB",
      "GLC",
      "GLE",
      "Sprinter",
      "Vito",
    ],
  },
  {
    name: "Audi",
    models: [
      "A1",
      "A3",
      "A4",
      "A5",
      "A6",
      "Q2",
      "Q3",
      "Q5",
      "Q7",
      "Q8",
    ],
  },
  {
    name: "Jeep",
    models: [
      "Renegade",
      "Compass",
      "Commander",
      "Cherokee",
      "Grand Cherokee",
      "Wrangler",
    ],
  },
  {
    name: "RAM",
    models: ["1500", "2500", "Rampage"],
  },
  {
    name: "Mitsubishi",
    models: ["L200", "Triton", "Outlander", "Eclipse Cross", "ASX", "Montero"],
  },
  {
    name: "Suzuki",
    models: ["Swift", "Baleno", "S-Presso", "Jimny", "Vitara", "S-Cross"],
  },
  {
    name: "DS",
    models: ["DS3", "DS4", "DS7"],
  },
  {
    name: "Dodge",
    models: ["Journey", "Ram", "Charger"],
  },
  {
    name: "Alfa Romeo",
    models: ["Giulia", "Stelvio", "Tonale"],
  },
  {
    name: "Mini",
    models: ["Cooper", "Countryman", "Clubman"],
  },
  {
    name: "Volvo",
    models: ["XC40", "XC60", "XC90", "S60", "V40"],
  },
  {
    name: "Chery",
    models: ["Tiggo 2", "Tiggo 4", "Tiggo 7", "Tiggo 8", "Arrizo 5"],
  },
];

async function seedVehicleCatalog() {
  console.log("🚗 Seeding catálogo de vehículos…");

  for (const f of FIXTURES) {
    const brand = await prisma.vehicleBrand.upsert({
      where: { name: f.name },
      update: { isActive: true },
      create: { name: f.name, isActive: true },
    });
    for (const modelName of f.models) {
      await prisma.vehicleModel.upsert({
        where: {
          brandId_name: { brandId: brand.id, name: modelName },
        },
        update: { isActive: true },
        create: {
          brandId: brand.id,
          name: modelName,
          isActive: true,
        },
      });
    }
    console.log(`   ✓ ${f.name} (${f.models.length} modelos)`);
  }

  const brands = await prisma.vehicleBrand.count();
  const models = await prisma.vehicleModel.count();
  console.log(`\n📊 Total: ${brands} marcas · ${models} modelos`);
}

seedVehicleCatalog()
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
