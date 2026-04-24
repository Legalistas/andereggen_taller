/**
 * Seed de repuestos de ejemplo para el inventario.
 * Usa precios coherentes con los montos del presupuesto de referencia (Aveldaño
 * Toyota Corolla) para que los números se vean realistas en demos.
 *
 * Reruneable: limpia movimientos + partes antes de insertar.
 */

import { prisma } from "../../src/lib/prisma";
import type { PartCategory } from "../../generated/prisma/client";

type PartFixture = {
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

const FIXTURES: PartFixture[] = [
    // --- Cristalería ---
    {
        sku: "CRST-LUNETA-COR",
        name: "Luneta térmica Toyota Corolla",
        brand: "AGC",
        appliesTo: "Toyota Corolla 2014–2020",
        category: "CRISTALERIA",
        costPrice: 320000,
        salePrice: 485000,
        stockQty: 3,
        stockMin: 2,
    },
    {
        sku: "CRST-PARAB-HONDA",
        name: "Parabrisas laminado Honda Civic",
        brand: "Saint Gobain",
        appliesTo: "Honda Civic 2016–2022",
        category: "CRISTALERIA",
        costPrice: 280000,
        salePrice: 420000,
        stockQty: 2,
        stockMin: 2,
    },
    {
        sku: "CRST-KIT-PEG",
        name: "Kit pegamento parabrisas/luneta",
        brand: "Sika",
        category: "CRISTALERIA",
        costPrice: 11000,
        salePrice: 18000,
        stockQty: 15,
        stockMin: 5,
    },

    // --- Carrocería ---
    {
        sku: "CAR-PANEL-COLA-COR",
        name: "Panel cola de carrocería Corolla",
        appliesTo: "Toyota Corolla 2014–2020",
        category: "CARROCERIA",
        costPrice: 520000,
        salePrice: 780000,
        stockQty: 1,
        stockMin: 1,
    },
    {
        sku: "CAR-CAPOT-VWG",
        name: "Capot motor VW Golf",
        appliesTo: "VW Golf 2014–2021",
        category: "CARROCERIA",
        costPrice: 450000,
        salePrice: 680000,
        stockQty: 2,
        stockMin: 1,
    },
    {
        sku: "CAR-GUARDABARRO-COR-DD",
        name: "Guardabarro delantero derecho Corolla",
        appliesTo: "Toyota Corolla 2014–2020",
        category: "CARROCERIA",
        costPrice: 180000,
        salePrice: 285000,
        stockQty: 4,
        stockMin: 2,
    },
    {
        sku: "CAR-PORTON-HILUX",
        name: "Portón trasero Toyota Hilux",
        appliesTo: "Toyota Hilux 2016–2023",
        category: "CARROCERIA",
        costPrice: 620000,
        salePrice: 950000,
        stockQty: 0,
        stockMin: 1,
    },

    // --- Iluminación ---
    {
        sku: "ILU-OPT-CRZ-IZQ",
        name: "Óptica izquierda Chevrolet Cruze",
        brand: "Depo",
        appliesTo: "Chevrolet Cruze 2016–2020",
        category: "ILUMINACION",
        costPrice: 260000,
        salePrice: 390000,
        stockQty: 2,
        stockMin: 1,
    },
    {
        sku: "ILU-OPT-COR-DER",
        name: "Óptica derecha Corolla",
        brand: "TYC",
        appliesTo: "Toyota Corolla 2014–2020",
        category: "ILUMINACION",
        costPrice: 240000,
        salePrice: 360000,
        stockQty: 3,
        stockMin: 1,
    },
    {
        sku: "ILU-GRILLA-CRZ",
        name: "Grilla central frente Cruze",
        appliesTo: "Chevrolet Cruze 2016–2020",
        category: "CARROCERIA",
        costPrice: 62000,
        salePrice: 95000,
        stockQty: 5,
        stockMin: 2,
    },

    // --- Interior ---
    {
        sku: "INT-BUTACAS-TRAS",
        name: "Butacas traseras (funda + bastidor)",
        appliesTo: "Toyota Corolla",
        category: "INTERIOR",
        costPrice: 210000,
        salePrice: 320000,
        stockQty: 2,
        stockMin: 1,
    },
    {
        sku: "INT-MANIJA-PTA",
        name: "Manija interior puerta",
        category: "INTERIOR",
        costPrice: 28000,
        salePrice: 45000,
        stockQty: 12,
        stockMin: 4,
    },

    // --- Airbags / electricidad ---
    {
        sku: "ELE-AIRBAG-LAT-DER",
        name: "Airbag lateral delantero derecho",
        appliesTo: "Mazda CX-5 2018–2022",
        category: "ELECTRICO",
        costPrice: 450000,
        salePrice: 680000,
        stockQty: 1,
        stockMin: 1,
    },

    // --- Frenos ---
    {
        sku: "FREN-PAST-DEL-GEN",
        name: "Pastillas de freno delanteras (juego)",
        brand: "Jurid",
        category: "FRENOS",
        costPrice: 38000,
        salePrice: 62000,
        stockQty: 20,
        stockMin: 8,
    },
    {
        sku: "FREN-DISCO-DEL",
        name: "Disco de freno delantero",
        brand: "Fremec",
        category: "FRENOS",
        costPrice: 52000,
        salePrice: 84000,
        stockQty: 8,
        stockMin: 4,
    },

    // --- Filtros ---
    {
        sku: "FILT-ACEITE-GEN",
        name: "Filtro de aceite",
        brand: "Mann",
        category: "FILTROS",
        costPrice: 8500,
        salePrice: 14500,
        stockQty: 40,
        stockMin: 10,
    },
    {
        sku: "FILT-AIRE-GEN",
        name: "Filtro de aire motor",
        brand: "Mann",
        category: "FILTROS",
        costPrice: 12000,
        salePrice: 19500,
        stockQty: 25,
        stockMin: 8,
    },
    {
        sku: "FILT-CABINA",
        name: "Filtro de cabina (habitáculo)",
        category: "FILTROS",
        costPrice: 15000,
        salePrice: 24000,
        stockQty: 18,
        stockMin: 6,
    },

    // --- Suspensión ---
    {
        sku: "SUSP-AMORT-DEL",
        name: "Amortiguador delantero",
        brand: "Monroe",
        category: "SUSPENSION",
        costPrice: 95000,
        salePrice: 155000,
        stockQty: 6,
        stockMin: 2,
    },

    // --- Pintura ---
    {
        sku: "PINT-BASE-BLCO",
        name: "Base color blanco perla (1L)",
        brand: "Sinteplast",
        category: "PINTURA",
        costPrice: 28000,
        salePrice: 46000,
        stockQty: 7,
        stockMin: 3,
    },
    {
        sku: "PINT-BARNIZ",
        name: "Barniz poliuretánico (1L)",
        brand: "Sinteplast",
        category: "PINTURA",
        costPrice: 32000,
        salePrice: 52000,
        stockQty: 9,
        stockMin: 3,
    },
];

async function seedSampleParts() {
    console.log("🔧 Seeding repuestos…\n");

    console.log("🧹 Cleaning previous parts + movements…");
    await prisma.partMovement.deleteMany({});
    // BudgetPart puede referenciar Part con onDelete: SetNull — esto lo limpia solo
    await prisma.part.deleteMany({});

    console.log("✅ Clean\n");

    const admin = await prisma.user.findUnique({ where: { email: "admin@example.com" } });

    console.log("📦 Creando partes + movimiento inicial de stock (IN) por cada una…");
    for (const f of FIXTURES) {
        const part = await prisma.part.create({
            data: { ...f },
        });
        if (f.stockQty > 0) {
            await prisma.partMovement.create({
                data: {
                    partId: part.id,
                    type: "IN",
                    qty: f.stockQty,
                    reason: "Stock inicial",
                    createdById: admin?.id ?? null,
                },
            });
        }
        const lowBadge = f.stockQty <= f.stockMin ? " ⚠ bajo stock" : "";
        const zeroBadge = f.stockQty === 0 ? " ❗ sin stock" : "";
        console.log(
            `   ✓ [${f.sku.padEnd(22)}] ${f.name.padEnd(44)} stock=${f.stockQty}${lowBadge}${zeroBadge}`,
        );
    }

    const [totalParts, totalMovements] = await Promise.all([
        prisma.part.count(),
        prisma.partMovement.count(),
    ]);

    console.log("\n📊 Summary:");
    console.log(`   Repuestos:    ${totalParts}`);
    console.log(`   Movimientos:  ${totalMovements}`);
}

seedSampleParts()
    .catch((err) => {
        console.error("❌ Error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log("\n🔌 Disconnected");
    });
