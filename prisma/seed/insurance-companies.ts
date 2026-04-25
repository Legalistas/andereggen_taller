/**
 * Seed de aseguradoras con las que trabaja el taller.
 * Las que aparecen en los ejemplos de leads y el presupuesto Aveldaño.
 */

import { prisma } from "../../src/lib/prisma";

type Fixture = {
  name: string;
  phone?: string;
  email?: string;
  contactName?: string;
  notes?: string;
};

const FIXTURES: Fixture[] = [
  {
    name: "El Norte",
    phone: "0810-555-6678",
    email: "siniestros@elnorte.com.ar",
    contactName: "Mesa de siniestros",
  },
  {
    name: "La Caja",
    phone: "0810-222-5252",
    email: "siniestros@lacaja.com.ar",
  },
  {
    name: "Federación Patronal",
    phone: "(0221) 4290300",
    email: "siniestros@fedpat.com.ar",
    contactName: "Sucursal Rafaela",
  },
  {
    name: "Sancor Seguros",
    phone: "0800-444-7262",
    email: "siniestros@sancorseguros.com",
    notes: "Centro de siniestros en Sunchales.",
  },
  {
    name: "Mercantil Andina",
    phone: "0810-222-6372",
    email: "siniestros@mercantilandina.com.ar",
  },
  {
    name: "Río Uruguay",
    phone: "0800-444-7488",
    email: "siniestros@riouruguay.com.ar",
  },
  {
    name: "Provincia Seguros",
    phone: "0800-222-5252",
    email: "siniestros@provinciaseguros.com.ar",
  },
];

async function seedInsuranceCompanies() {
  console.log("🏢 Seeding aseguradoras…");

  for (const f of FIXTURES) {
    await prisma.insuranceCompany.upsert({
      where: { name: f.name },
      update: { ...f, isActive: true },
      create: { ...f, isActive: true },
    });
    console.log(`   ✓ ${f.name}`);
  }

  const total = await prisma.insuranceCompany.count();
  console.log(`\n📊 Total aseguradoras: ${total}`);
}

seedInsuranceCompanies()
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
