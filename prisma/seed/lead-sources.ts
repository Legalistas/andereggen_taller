/**
 * Seed de fuentes de lead. Hoy `Lead.source` es String libre; esta tabla da
 * un catálogo consistente (el UI usa los `key` como values).
 */

import { prisma } from "../../src/lib/prisma";

type Fixture = { key: string; label: string; order: number };

const FIXTURES: Fixture[] = [
    { key: "web", label: "Formulario web", order: 10 },
    { key: "whatsapp", label: "WhatsApp", order: 20 },
    { key: "telefono", label: "Teléfono", order: 30 },
    { key: "manual", label: "Carga manual", order: 40 },
    { key: "referido", label: "Cliente referido", order: 50 },
    { key: "redes_sociales", label: "Redes sociales", order: 60 },
    { key: "seguro", label: "Derivación de seguro", order: 70 },
    { key: "otro", label: "Otro", order: 999 },
];

async function seedLeadSources() {
    console.log("📥 Seeding fuentes de lead…");

    for (const f of FIXTURES) {
        await prisma.leadSource.upsert({
            where: { key: f.key },
            update: { label: f.label, order: f.order, isActive: true },
            create: { ...f, isActive: true },
        });
        console.log(`   ✓ ${f.key.padEnd(14)} → ${f.label}`);
    }

    const total = await prisma.leadSource.count();
    console.log(`\n📊 Total fuentes: ${total}`);
}

seedLeadSources()
    .catch((err) => {
        console.error("❌ Error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
