/**
 * Seed del singleton AppSettings con datos del taller Andereggen.
 * Reruneable — hace upsert por id = "app".
 */

import { prisma } from "../../src/lib/prisma";

async function seedAppSettings() {
    console.log("⚙️  Seeding AppSettings (singleton)…");

    const s = await prisma.appSettings.upsert({
        where: { id: "app" },
        update: {},
        create: {
            id: "app",
            companyName: "Andereggen Taller Automotor",
            companyAddress: "Aconcagua 663 — Rafaela, Santa Fe",
            companyCuit: "30-12345678-9",
            companyPhone: "(03492) 155-90753 · 427211",
            companyEmail: "andereggen.taller@gmail.com",
            companyWebsite: "https://andereggen.com.ar",

            defaultIvaRate: 21.0,
            defaultValidityDays: 10,
            defaultDeliveryDays: 20,
            defaultPaymentCondition: "Contado contra entrega",

            notifyOnLeadCreated: true,
            notifyOnBudgetSent: true,
            notifyOnBudgetReminder: true,
            notifyOnStageChange: true,
            reminderDaysAfterSent: 5,

            locale: "es-AR",
            currency: "ARS",
            timezone: "America/Argentina/Buenos_Aires",

            whatsappEnabled: false,
            mpEnabled: false,
            afipEnabled: false,
        },
    });

    console.log(`   ✓ ${s.companyName} (${s.companyEmail})`);
}

seedAppSettings()
    .catch((err) => {
        console.error("❌ Error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
