/**
 * Seed de herramientas de ejemplo (activos físicos del taller).
 * Cada registro = una herramienta individual. Si necesitás 3 llaves iguales,
 * creá 3 registros con códigos distintos (HER-001 / HER-002 / HER-003).
 */

import { prisma } from "../../src/lib/prisma";
import type { ToolCategory, ToolStatus } from "../../generated/prisma/client";

type ToolFixture = {
    code: string;
    name: string;
    brand?: string;
    category: ToolCategory;
    status?: ToolStatus;
    location?: string;
    cost: number;
    notes?: string;
    assignedToEmail?: string; // si viene, buscamos el user y marcamos IN_USE
    acquiredDaysAgo?: number;
};

const FIXTURES: ToolFixture[] = [
    // --- Soldadura ---
    {
        code: "SOL-001",
        name: "Soldadora MIG 250A",
        brand: "Lincoln Electric",
        category: "SOLDADURA",
        location: "Box 1 - Chapa",
        cost: 1250000,
        acquiredDaysAgo: 420,
    },
    {
        code: "SOL-002",
        name: "Soldadora inverter TIG",
        brand: "Lincoln Electric",
        category: "SOLDADURA",
        location: "Box 2 - Chapa",
        cost: 980000,
        acquiredDaysAgo: 200,
        assignedToEmail: "admin@example.com",
    },

    // --- Elevación ---
    {
        code: "ELE-001",
        name: "Elevador de 2 columnas 4T",
        brand: "Ravaglioli",
        category: "ELEVACION",
        location: "Box 1",
        cost: 4500000,
        acquiredDaysAgo: 800,
    },
    {
        code: "ELE-002",
        name: "Elevador tijera móvil",
        brand: "Werther",
        category: "ELEVACION",
        status: "MAINTENANCE",
        location: "Depósito",
        cost: 1800000,
        acquiredDaysAgo: 350,
        notes: "En calibración — pendiente certificado ENRE.",
    },

    // --- Neumática ---
    {
        code: "NEU-001",
        name: "Compresor 300L",
        brand: "Schulz",
        category: "NEUMATICA",
        location: "Sala de compresor",
        cost: 850000,
        acquiredDaysAgo: 500,
    },
    {
        code: "NEU-002",
        name: "Pistola neumática 1/2\"",
        brand: "Chicago Pneumatic",
        category: "NEUMATICA",
        location: "Pañol",
        cost: 125000,
        acquiredDaysAgo: 90,
        assignedToEmail: "jonatanvilella@gmail.com",
    },

    // --- Hidráulica ---
    {
        code: "HID-001",
        name: "Bancada de estiramiento CarBench",
        brand: "CarBench",
        category: "HIDRAULICA",
        location: "Sala de bancada",
        cost: 7200000,
        acquiredDaysAgo: 1200,
    },
    {
        code: "HID-002",
        name: "Gato hidráulico 3T",
        brand: "Nakayama",
        category: "HIDRAULICA",
        location: "Pañol",
        cost: 45000,
        acquiredDaysAgo: 60,
    },

    // --- Pintura ---
    {
        code: "PIN-001",
        name: "Cabina de pintura con horno",
        brand: "USI Italia",
        category: "PINTURA",
        location: "Sala de pintura",
        cost: 9500000,
        acquiredDaysAgo: 1500,
    },
    {
        code: "PIN-002",
        name: "Pistola HVLP 1.3mm",
        brand: "SATA",
        category: "PINTURA",
        location: "Pañol",
        cost: 320000,
        acquiredDaysAgo: 150,
    },
    {
        code: "PIN-003",
        name: "Lámpara IR de secado",
        brand: "Trommelberg",
        category: "PINTURA",
        location: "Sala de pintura",
        cost: 680000,
        acquiredDaysAgo: 240,
    },

    // --- Diagnóstico / Eléctrico ---
    {
        code: "DIA-001",
        name: "Scanner OBD-II multimarca",
        brand: "Autel MaxiSys",
        category: "DIAGNOSTICO",
        location: "Oficina técnica",
        cost: 520000,
        acquiredDaysAgo: 180,
    },
    {
        code: "DIA-002",
        name: "Multímetro digital profesional",
        brand: "Fluke 87V",
        category: "ELECTRICA",
        location: "Oficina técnica",
        cost: 180000,
        acquiredDaysAgo: 100,
    },

    // --- Manual ---
    {
        code: "MAN-001",
        name: "Caja de llaves combinadas 8–32mm",
        brand: "Gedore",
        category: "MANUAL",
        location: "Pañol",
        cost: 95000,
        acquiredDaysAgo: 365,
    },
    {
        code: "MAN-002",
        name: "Martillo neumático desabollador",
        brand: "Bahco",
        category: "MANUAL",
        status: "RETIRED",
        location: "Descarte",
        cost: 75000,
        acquiredDaysAgo: 1800,
        notes: "Dado de baja 2025 — reemplazado por HID-002.",
    },
];

async function seedSampleTools() {
    console.log("🔨 Seeding herramientas…\n");

    console.log("🧹 Cleaning previous tools…");
    await prisma.tool.deleteMany({});
    console.log("✅ Clean\n");

    console.log("🛠️  Creando herramientas…");
    for (const f of FIXTURES) {
        let assignedToId: string | null = null;
        if (f.assignedToEmail) {
            const u = await prisma.user.findUnique({ where: { email: f.assignedToEmail } });
            assignedToId = u?.id ?? null;
        }
        const status: ToolStatus =
            f.status ?? (assignedToId ? "IN_USE" : "AVAILABLE");

        const acquiredAt = f.acquiredDaysAgo
            ? new Date(Date.now() - f.acquiredDaysAgo * 86400_000)
            : null;

        const tool = await prisma.tool.create({
            data: {
                code: f.code,
                name: f.name,
                brand: f.brand ?? null,
                category: f.category,
                status,
                assignedToId,
                location: f.location ?? null,
                cost: f.cost,
                acquiredAt,
                notes: f.notes ?? null,
            },
        });

        const badge =
            status === "IN_USE" ? ` 👤 ${f.assignedToEmail}` :
                status === "MAINTENANCE" ? " 🔧 mantenimiento" :
                    status === "RETIRED" ? " 🗑  baja" : "";
        console.log(`   ✓ [${tool.code?.padEnd(7)}] ${tool.name.padEnd(44)}${badge}`);
    }

    const [total, byStatus] = await Promise.all([
        prisma.tool.count(),
        prisma.tool.groupBy({ by: ["status"], _count: true }),
    ]);

    console.log("\n📊 Summary:");
    console.log(`   Total: ${total}`);
    for (const row of byStatus) {
        console.log(`     - ${row.status.padEnd(12)} ${row._count}`);
    }
}

seedSampleTools()
    .catch((err) => {
        console.error("❌ Error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log("\n🔌 Disconnected");
    });
