/**
 * Seed de herramientas típicas para un taller de chapa, pintura y mecánica.
 * ~35 items distribuidos entre las 9 categorías de ToolCategory.
 *
 * Idempotente: usa el campo `code` (patrimonial interno) como clave única.
 */

import { prisma } from "../../src/lib/prisma";
import type {
  ToolCategory,
  ToolStatus,
} from "../../generated/prisma/client";

type Fixture = {
  code: string;
  name: string;
  description?: string;
  brand?: string;
  category: ToolCategory;
  status?: ToolStatus;
  location?: string;
  cost: number;
};

const FIXTURES: Fixture[] = [
  // ─── NEUMATICA
  { code: "NEU-001", name: "Pistola de impacto 1/2\"", brand: "Bosch", category: "NEUMATICA", location: "Box 1", cost: 145000 },
  { code: "NEU-002", name: "Pistola de impacto 1/2\"", brand: "Stanley", category: "NEUMATICA", location: "Box 2", cost: 95000 },
  { code: "NEU-003", name: "Lijadora orbital neumática 6\"", brand: "Sata", category: "NEUMATICA", location: "Sector chapa", cost: 178000 },
  { code: "NEU-004", name: "Lijadora rotativa neumática", brand: "Mirka", category: "NEUMATICA", location: "Sector chapa", cost: 220000 },
  { code: "NEU-005", name: "Atornillador neumático", brand: "Stanley", category: "NEUMATICA", location: "Depósito", cost: 78000 },
  { code: "NEU-006", name: "Pulidora neumática 7\"", brand: "Rupes", category: "NEUMATICA", location: "Sector pintura", cost: 285000 },
  { code: "NEU-007", name: "Sopladora neumática", brand: "Sata", category: "NEUMATICA", location: "Box 1", cost: 22000 },

  // ─── HIDRAULICA
  { code: "HID-001", name: "Gato hidráulico tipo lagarto 3T", brand: "Black Bull", category: "HIDRAULICA", location: "Box 2", cost: 185000 },
  { code: "HID-002", name: "Gato hidráulico tipo lagarto 3T", brand: "Power Bull", category: "HIDRAULICA", location: "Box 3", cost: 175000 },
  { code: "HID-003", name: "Prensa hidráulica 20T", brand: "Power Bull", category: "HIDRAULICA", location: "Sector mecánica", cost: 580000 },
  { code: "HID-004", name: "Tira-chapa hidráulico 10T", brand: "Power Bull", category: "HIDRAULICA", location: "Sector chapa", cost: 420000 },
  { code: "HID-005", name: "Bancada de estiramiento Globaljig", brand: "Globaljig", category: "HIDRAULICA", location: "Sector chapa", cost: 8500000 },

  // ─── ELECTRICA
  { code: "ELE-001", name: "Amoladora angular 4 1/2\"", brand: "Bosch", category: "ELECTRICA", location: "Depósito", cost: 78000 },
  { code: "ELE-002", name: "Amoladora angular 7\"", brand: "DeWalt", category: "ELECTRICA", location: "Depósito", cost: 145000 },
  { code: "ELE-003", name: "Taladro percutor", brand: "Makita", category: "ELECTRICA", location: "Box 1", cost: 95000 },
  { code: "ELE-004", name: "Taladro de banco", brand: "Stanley", category: "ELECTRICA", location: "Sector mecánica", cost: 320000 },
  { code: "ELE-005", name: "Lijadora eléctrica orbital", brand: "Bosch", category: "ELECTRICA", location: "Sector chapa", cost: 88000 },
  { code: "ELE-006", name: "Sierra circular", brand: "Makita", category: "ELECTRICA", location: "Depósito", cost: 165000 },

  // ─── MANUAL
  { code: "MAN-001", name: "Juego de llaves combinadas (8-32mm)", brand: "Stanley", category: "MANUAL", location: "Box 1", cost: 95000 },
  { code: "MAN-002", name: "Juego de tubos 1/2\" (10-32mm)", brand: "Stanley", category: "MANUAL", location: "Box 2", cost: 78000 },
  { code: "MAN-003", name: "Juego de destornilladores Philips/plano", brand: "Tramontina", category: "MANUAL", location: "Box 1", cost: 28000 },
  { code: "MAN-004", name: "Martillo de chapista", brand: "Picard", category: "MANUAL", location: "Sector chapa", cost: 42000 },
  { code: "MAN-005", name: "Tas de chapista (juego)", brand: "Picard", category: "MANUAL", location: "Sector chapa", cost: 95000 },
  { code: "MAN-006", name: "Pinzas / alicate universal", brand: "Stanley", category: "MANUAL", location: "Box 2", cost: 18000 },

  // ─── ELEVACION
  { code: "EVA-001", name: "Elevador 2 columnas 4T", brand: "Rotary", category: "ELEVACION", location: "Box 1", cost: 4200000 },
  { code: "EVA-002", name: "Elevador 2 columnas 4T", brand: "Rotary", category: "ELEVACION", location: "Box 2", cost: 4200000 },
  { code: "EVA-003", name: "Grúa hidráulica plegable 1T", brand: "Power Bull", category: "ELEVACION", location: "Sector mecánica", cost: 380000 },
  { code: "EVA-004", name: "Caballete soporte 3T (par)", brand: "Stanley", category: "ELEVACION", location: "Sector mecánica", cost: 65000 },

  // ─── SOLDADURA
  { code: "SOL-001", name: "Soldadora MIG/MAG 200A", brand: "Lincoln", category: "SOLDADURA", location: "Sector chapa", cost: 850000 },
  { code: "SOL-002", name: "Soldadora MIG inverter 180A", brand: "Telwin", category: "SOLDADURA", location: "Sector chapa", cost: 620000 },
  { code: "SOL-003", name: "Spotter (suelda por puntos)", brand: "Telwin", category: "SOLDADURA", location: "Sector chapa", cost: 420000 },
  { code: "SOL-004", name: "Careta de soldar fotosensible", brand: "Lincoln", category: "SOLDADURA", location: "Sector chapa", cost: 78000 },
  { code: "SOL-005", name: "Careta de soldar fotosensible", brand: "3M Speedglas", category: "SOLDADURA", location: "Sector chapa", cost: 185000 },

  // ─── PINTURA
  { code: "PIN-001", name: "Pistola de pintura HVLP", brand: "Sata", category: "PINTURA", location: "Cabina pintura", cost: 285000 },
  { code: "PIN-002", name: "Pistola de pintura HVLP gravedad", brand: "Devilbiss", category: "PINTURA", location: "Cabina pintura", cost: 320000 },
  { code: "PIN-003", name: "Pistola de retoque mini", brand: "Sata", category: "PINTURA", location: "Cabina pintura", cost: 145000 },
  { code: "PIN-004", name: "Compresor 3HP 100L", brand: "Schulz", category: "PINTURA", location: "Sector compresores", cost: 580000 },
  { code: "PIN-005", name: "Cabina de pintura presurizada", brand: "Saima", category: "PINTURA", location: "Cabina pintura", cost: 12500000 },
  { code: "PIN-006", name: "Lámpara infrarroja secado", brand: "TrommelBerg", category: "PINTURA", location: "Cabina pintura", cost: 850000 },

  // ─── DIAGNOSTICO
  { code: "DIA-001", name: "Scanner OBD2 multimarca", brand: "Launch X431", category: "DIAGNOSTICO", location: "Sector mecánica", cost: 680000 },
  { code: "DIA-002", name: "Multímetro digital", brand: "Fluke", category: "DIAGNOSTICO", location: "Sector mecánica", cost: 95000 },
  { code: "DIA-003", name: "Comprobador de batería", brand: "Bosch", category: "DIAGNOSTICO", location: "Sector mecánica", cost: 145000 },
  { code: "DIA-004", name: "Manómetro de presión de gases A/A", brand: "Robinair", category: "DIAGNOSTICO", location: "Sector mecánica", cost: 88000 },

  // ─── OTROS
  { code: "OTR-001", name: "Aspiradora industrial", brand: "Karcher", category: "OTROS", location: "Depósito", cost: 220000 },
  { code: "OTR-002", name: "Hidrolavadora", brand: "Karcher", category: "OTROS", location: "Sector lavado", cost: 380000 },
  { code: "OTR-003", name: "Carro porta-herramientas (gabinete)", brand: "Stanley", category: "OTROS", location: "Box 1", cost: 480000 },
];

async function seedSampleTools() {
  console.log("🛠  Seeding sample tools...\n");

  for (const f of FIXTURES) {
    await prisma.tool.upsert({
      where: { code: f.code },
      update: { ...f, status: f.status ?? "AVAILABLE", isActive: true },
      create: { ...f, status: f.status ?? "AVAILABLE", isActive: true },
    });
    console.log(`   ✓ ${f.code.padEnd(8)} ${f.name}`);
  }

  const total = await prisma.tool.count();
  console.log(`\n🧰 Total herramientas en catálogo: ${total}`);
}

seedSampleTools()
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
