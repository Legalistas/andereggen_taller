/**
 * Seed de repuestos típicos para el taller — ~40 items distribuidos entre
 * carrocería, cristalería, mecánica, eléctrico, pintura, frenos, suspensión,
 * filtros, iluminación e interior. Usado para que la pantalla /inventario no
 * arranque vacía.
 *
 * Idempotente: usa el SKU como clave única.
 */

import { prisma } from "../../src/lib/prisma";
import type { PartCategory } from "../../generated/prisma/client";

type Fixture = {
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  appliesTo?: string;
  category: PartCategory;
  costPrice: number;
  salePrice: number;
  stockQty: number;
  stockMin: number;
};

const FIXTURES: Fixture[] = [
  // ── CARROCERIA
  { sku: "CAR-001", name: "Capot motor", category: "CARROCERIA", brand: "Original", appliesTo: "Renault Sandero / Logan", costPrice: 480000, salePrice: 621138, stockQty: 3, stockMin: 1 },
  { sku: "CAR-002", name: "Guardabarro delantero izquierdo", category: "CARROCERIA", brand: "Original", appliesTo: "Renault Kangoo", costPrice: 290000, salePrice: 369518, stockQty: 4, stockMin: 2 },
  { sku: "CAR-003", name: "Guardabarro delantero derecho", category: "CARROCERIA", brand: "Original", appliesTo: "Renault Kangoo", costPrice: 290000, salePrice: 369518, stockQty: 2, stockMin: 2 },
  { sku: "CAR-004", name: "Paragolpe delantero", category: "CARROCERIA", brand: "Original", appliesTo: "Toyota Hilux", costPrice: 510000, salePrice: 645000, stockQty: 1, stockMin: 1 },
  { sku: "CAR-005", name: "Paragolpe trasero", category: "CARROCERIA", brand: "Original", appliesTo: "VW Gol Trend", costPrice: 380000, salePrice: 480000, stockQty: 2, stockMin: 1 },
  { sku: "CAR-006", name: "Lámina paragolpe delantero", category: "CARROCERIA", brand: "Original", appliesTo: "Universal", costPrice: 215000, salePrice: 272115, stockQty: 5, stockMin: 2 },
  { sku: "CAR-007", name: "Grilla central de frente", category: "CARROCERIA", brand: "Original", appliesTo: "Renault Kangoo", costPrice: 105000, salePrice: 134288, stockQty: 3, stockMin: 1 },
  { sku: "CAR-008", name: "Frente de carrocería", category: "CARROCERIA", brand: "Original", appliesTo: "Renault Kangoo", costPrice: 380000, salePrice: 483956, stockQty: 1, stockMin: 1 },
  { sku: "CAR-009", name: "Tapa de baúl", category: "CARROCERIA", brand: "Original", appliesTo: "Fiat Cronos", costPrice: 410000, salePrice: 520000, stockQty: 2, stockMin: 1 },
  { sku: "CAR-010", name: "Puerta delantera izquierda", category: "CARROCERIA", brand: "Original", appliesTo: "Chevrolet Onix", costPrice: 620000, salePrice: 785000, stockQty: 1, stockMin: 1 },

  // ── CRISTALERIA
  { sku: "CRI-001", name: "Parabrisas laminado", category: "CRISTALERIA", brand: "Pilkington", appliesTo: "VW Gol Trend", costPrice: 180000, salePrice: 245000, stockQty: 4, stockMin: 2 },
  { sku: "CRI-002", name: "Parabrisas laminado", category: "CRISTALERIA", brand: "AGC", appliesTo: "Toyota Etios", costPrice: 195000, salePrice: 260000, stockQty: 3, stockMin: 2 },
  { sku: "CRI-003", name: "Luneta térmica", category: "CRISTALERIA", brand: "Pilkington", appliesTo: "Renault Sandero", costPrice: 210000, salePrice: 285000, stockQty: 2, stockMin: 1 },
  { sku: "CRI-004", name: "Cristal puerta delantera", category: "CRISTALERIA", brand: "AGC", appliesTo: "Universal", costPrice: 95000, salePrice: 128000, stockQty: 6, stockMin: 3 },
  { sku: "CRI-005", name: "Cristal puerta trasera", category: "CRISTALERIA", brand: "AGC", appliesTo: "Universal", costPrice: 88000, salePrice: 118000, stockQty: 5, stockMin: 3 },

  // ── MECANICA
  { sku: "MEC-001", name: "Radiador de agua", category: "MECANICA", brand: "Behr", appliesTo: "Renault Kangoo", costPrice: 185000, salePrice: 234332, stockQty: 2, stockMin: 1 },
  { sku: "MEC-002", name: "Condensador A/A", category: "MECANICA", brand: "Behr", appliesTo: "Renault Kangoo", costPrice: 155000, salePrice: 198796, stockQty: 2, stockMin: 1 },
  { sku: "MEC-003", name: "Electroventilador", category: "MECANICA", brand: "Bosch", appliesTo: "Renault Kangoo", costPrice: 178000, salePrice: 227122, stockQty: 1, stockMin: 1 },
  { sku: "MEC-004", name: "Bomba de agua", category: "MECANICA", brand: "Gates", appliesTo: "Universal 1.6", costPrice: 65000, salePrice: 89000, stockQty: 4, stockMin: 2 },
  { sku: "MEC-005", name: "Correa de distribución", category: "MECANICA", brand: "Gates", appliesTo: "Universal 1.6", costPrice: 28000, salePrice: 42000, stockQty: 8, stockMin: 4 },

  // ── ELECTRICO
  { sku: "ELE-001", name: "Batería 12V 65Ah", category: "ELECTRICO", brand: "Moura", appliesTo: "Universal nafta", costPrice: 95000, salePrice: 132000, stockQty: 5, stockMin: 2 },
  { sku: "ELE-002", name: "Alternador", category: "ELECTRICO", brand: "Bosch", appliesTo: "VW Gol", costPrice: 220000, salePrice: 295000, stockQty: 1, stockMin: 1 },
  { sku: "ELE-003", name: "Motor de arranque", category: "ELECTRICO", brand: "Bosch", appliesTo: "VW Gol", costPrice: 195000, salePrice: 265000, stockQty: 1, stockMin: 1 },

  // ── PINTURA
  { sku: "PIN-001", name: "Base bicapa blanca", category: "PINTURA", brand: "Sinteplast", appliesTo: "Universal", costPrice: 38000, salePrice: 55000, stockQty: 12, stockMin: 5 },
  { sku: "PIN-002", name: "Base bicapa negra", category: "PINTURA", brand: "Sinteplast", appliesTo: "Universal", costPrice: 38000, salePrice: 55000, stockQty: 8, stockMin: 5 },
  { sku: "PIN-003", name: "Barniz transparente", category: "PINTURA", brand: "Sinteplast", appliesTo: "Universal", costPrice: 42000, salePrice: 62000, stockQty: 10, stockMin: 4 },
  { sku: "PIN-004", name: "Masilla poliéster", category: "PINTURA", brand: "Sinteplast", appliesTo: "Universal", costPrice: 18000, salePrice: 28000, stockQty: 15, stockMin: 6 },

  // ── FRENOS
  { sku: "FRE-001", name: "Pastillas de freno delantero", category: "FRENOS", brand: "Ferodo", appliesTo: "VW Gol / Voyage", costPrice: 38000, salePrice: 55000, stockQty: 6, stockMin: 3 },
  { sku: "FRE-002", name: "Disco de freno delantero", category: "FRENOS", brand: "Ferodo", appliesTo: "VW Gol / Voyage", costPrice: 78000, salePrice: 108000, stockQty: 4, stockMin: 2 },

  // ── SUSPENSION
  { sku: "SUS-001", name: "Amortiguador delantero", category: "SUSPENSION", brand: "Sachs", appliesTo: "Universal", costPrice: 88000, salePrice: 122000, stockQty: 4, stockMin: 2 },
  { sku: "SUS-002", name: "Espiral delantero", category: "SUSPENSION", brand: "Original", appliesTo: "Universal", costPrice: 42000, salePrice: 62000, stockQty: 6, stockMin: 2 },

  // ── FILTROS
  { sku: "FIL-001", name: "Filtro de aceite", category: "FILTROS", brand: "Mann", appliesTo: "Universal nafta", costPrice: 8500, salePrice: 14000, stockQty: 25, stockMin: 10 },
  { sku: "FIL-002", name: "Filtro de aire", category: "FILTROS", brand: "Mann", appliesTo: "Universal nafta", costPrice: 12000, salePrice: 19000, stockQty: 18, stockMin: 8 },
  { sku: "FIL-003", name: "Filtro de combustible", category: "FILTROS", brand: "Mann", appliesTo: "Universal nafta", costPrice: 15000, salePrice: 23000, stockQty: 14, stockMin: 6 },
  { sku: "FIL-004", name: "Filtro habitáculo / antipolen", category: "FILTROS", brand: "Mann", appliesTo: "Universal", costPrice: 11000, salePrice: 17000, stockQty: 12, stockMin: 5 },

  // ── ILUMINACION
  { sku: "ILU-001", name: "Óptica delantera izquierda", category: "ILUMINACION", brand: "Original", appliesTo: "Renault Kangoo", costPrice: 235000, salePrice: 297550, stockQty: 1, stockMin: 1 },
  { sku: "ILU-002", name: "Óptica delantera derecha", category: "ILUMINACION", brand: "Original", appliesTo: "Renault Kangoo", costPrice: 235000, salePrice: 297550, stockQty: 1, stockMin: 1 },
  { sku: "ILU-003", name: "Lámpara H4 12V 60/55W", category: "ILUMINACION", brand: "Osram", appliesTo: "Universal", costPrice: 4500, salePrice: 8500, stockQty: 30, stockMin: 12 },
  { sku: "ILU-004", name: "Lámpara H7 12V 55W", category: "ILUMINACION", brand: "Osram", appliesTo: "Universal", costPrice: 4800, salePrice: 9000, stockQty: 28, stockMin: 12 },

  // ── INTERIOR
  { sku: "INT-001", name: "Tapizado puerta delantera", category: "INTERIOR", brand: "Original", appliesTo: "Renault Sandero", costPrice: 95000, salePrice: 128000, stockQty: 2, stockMin: 1 },
  { sku: "INT-002", name: "Manija interior puerta", category: "INTERIOR", brand: "Original", appliesTo: "Universal", costPrice: 18000, salePrice: 28000, stockQty: 8, stockMin: 4 },
];

async function seedSampleParts() {
  console.log("🔧 Seeding sample parts...\n");

  for (const f of FIXTURES) {
    await prisma.part.upsert({
      where: { sku: f.sku },
      update: { ...f, isActive: true },
      create: { ...f, isActive: true },
    });
    console.log(`   ✓ ${f.sku.padEnd(8)} ${f.name}`);
  }

  const total = await prisma.part.count();
  console.log(`\n📦 Total repuestos en catálogo: ${total}`);
}

seedSampleParts()
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
