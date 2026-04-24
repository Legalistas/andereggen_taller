/**
 * Seed de leads + presupuestos de muestra.
 *
 * Objetivo: poblar el CRM con datos creíbles para demos/presentaciones.
 * - Cubre TODOS los estados del embudo (solicitud → ganado/perdido).
 * - Presupuestos con las 3 mecánicas de concepto (descriptivo, por unidades, fijo).
 * - Inspirado en el presupuesto real del taller (Aveldaño, Toyota Corolla 2017).
 *
 * Reruneable: limpia leads/budgets previos. NO toca customers/vehicles (corré
 * sample-clients antes si no los tenés).
 */

import { computeBudgetTotals, computeConceptSubtotal, computePartSubtotal } from "../../src/lib/budget-catalog";
import { prisma } from "../../src/lib/prisma";
import type {
    BudgetStatus,
    ConceptCategory,
    ConceptType,
    LeadLostReason,
    LeadStatus,
} from "../../generated/prisma/client";

// =====================================================
// Types para fixtures
// =====================================================

type ConceptFixture =
    | {
        type: "DESCRIPTIVO";
        category: ConceptCategory;
        subdetails: string[];
        additionalDetail?: string;
    }
    | {
        type: "UNIDADES";
        category: ConceptCategory;
        units: number;
        unitValue: number;
    }
    | {
        type: "FIJO";
        category: ConceptCategory;
        fixedAmount: number;
        fixedDescription?: string;
    };

type PartFixture = { quantity: number; description: string; unitPrice: number };

type BudgetFixture = {
    status: BudgetStatus;
    observations?: string;
    validityDays?: number;
    deliveryDays?: number;
    paymentCondition?: string;
    concepts: ConceptFixture[];
    parts: PartFixture[];
};

type LeadFixture = {
    customerEmail: string; // resuelve al customer existente
    vehicle: {
        brand: string;
        model: string;
        year: string;
        domain: string;
        secure?: string;
        thirdPartySecure?: string;
    };
    status: LeadStatus;
    notes?: string;
    source?: string;
    lostReason?: LeadLostReason;
    lostNotes?: string;
    createdDaysAgo?: number;
    budget?: BudgetFixture;
};

// =====================================================
// FIXTURES — 10 leads cubriendo todos los estados
// =====================================================

const FIXTURES: LeadFixture[] = [
    // 1) SOLICITUD — recién entró, sin presupuesto todavía
    {
        customerEmail: "juan.garcia@email.com",
        vehicle: { brand: "Toyota", model: "Corolla", year: "2020", domain: "ABC123", secure: "La Caja" },
        status: "solicitud",
        notes: "Cliente pidió presupuesto por formulario web. Requiere revisión general y cambio de aceite.",
        source: "web",
        createdDaysAgo: 1,
    },
    // 2) SOLICITUD — derivado de seguro
    {
        customerEmail: "maria.rodriguez@email.com",
        vehicle: { brand: "Ford", model: "Focus", year: "2019", domain: "DEF456", secure: "Federación Patronal" },
        status: "solicitud",
        notes: "Choque lateral leve. Aseguradora pidió cotización preliminar.",
        source: "whatsapp",
        createdDaysAgo: 2,
    },

    // 3) CONTROL — presupuesto en draft, siendo revisado internamente
    {
        customerEmail: "carlos.lopez@email.com",
        vehicle: { brand: "Volkswagen", model: "Golf", year: "2021", domain: "GHI789", secure: "La Caja" },
        status: "control",
        notes: "Presupuesto en revisión por encargado de chapa antes de enviar.",
        createdDaysAgo: 3,
        budget: {
            status: "draft",
            concepts: [
                { type: "DESCRIPTIVO", category: "DESABOLLAR", subdetails: ["guardabarro_del_izq", "panel_puerta_del_izq"] },
                { type: "UNIDADES", category: "CHAPA", units: 2, unitValue: 450000 },
                { type: "UNIDADES", category: "PINTURA", units: 2, unitValue: 380000 },
            ],
            parts: [
                { quantity: 1, description: "Moldura puerta delantera izquierda original VW", unitPrice: 125000 },
            ],
            observations: "Pendiente confirmar tonalidad de pintura con cliente.",
        },
    },

    // 4) ENVIADO — presupuesto enviado, esperando respuesta (el del PDF: Aveldaño)
    {
        customerEmail: "pablo.aveldano@email.com",
        vehicle: { brand: "Toyota", model: "Corolla SE-G", year: "2017", domain: "AA927LA", secure: "El Norte", thirdPartySecure: "El Norte" },
        status: "enviado",
        notes: "Choque frontal severo. Derivación seguro El Norte.",
        source: "manual",
        createdDaysAgo: 5,
        budget: {
            status: "sent",
            observations: "Validez 10 días. Desarmado el vehículo, el presupuesto podrá sufrir modificaciones.",
            deliveryDays: 30,
            concepts: [
                {
                    type: "DESCRIPTIVO",
                    category: "DESMONTAR",
                    subdetails: [
                        "guardaplast_ambos_traseros",
                        "tapizado_baul",
                        "luneta_termica",
                        "asientos_traseros",
                    ],
                },
                {
                    type: "DESCRIPTIVO",
                    category: "BANCADA_DE_ESTIRAMIENTO",
                    subdetails: ["escuadrar_compacto_cola"],
                },
                {
                    type: "DESCRIPTIVO",
                    category: "DESMONTAR_Y_CAMBIAR",
                    subdetails: ["repuestos_hoja_adjunta"],
                    additionalDetail: "Repuestos que se detallan en hoja a continuación",
                },
                {
                    type: "DESCRIPTIVO",
                    category: "DESABOLLAR",
                    subdetails: ["partes_dañadas_choque"],
                },
                { type: "FIJO", category: "MECANICA", fixedAmount: 2800000 },
                { type: "FIJO", category: "COLOCACION_LUNETA", fixedAmount: 95000 },
            ],
            parts: [
                { quantity: 1, description: "Luneta térmica Toyota Corolla", unitPrice: 485000 },
                { quantity: 1, description: "Panel cola de carrocería", unitPrice: 780000 },
                { quantity: 2, description: "Butacas traseras (funda + bastidor)", unitPrice: 320000 },
                { quantity: 1, description: "Kit pegamento luneta", unitPrice: 18000 },
                { quantity: 1, description: "Mano de obra adicional suspensión", unitPrice: 735433 },
            ],
        },
    },

    // 5) ENVIADO — pintura completa post-granizo
    {
        customerEmail: "lucia.fernandez@email.com",
        vehicle: { brand: "Honda", model: "Civic", year: "2022", domain: "AB456CD", secure: "Sancor" },
        status: "enviado",
        notes: "Daño por granizo en techo, capot y tapa de baúl.",
        source: "web",
        createdDaysAgo: 7,
        budget: {
            status: "sent",
            concepts: [
                {
                    type: "DESCRIPTIVO",
                    category: "DESABOLLAR",
                    subdetails: ["capot_motor", "lamina_techo", "tapa_baul"],
                },
                { type: "UNIDADES", category: "CHAPA", units: 3, unitValue: 520000 },
                { type: "UNIDADES", category: "PINTURA", units: 3, unitValue: 490000 },
                { type: "FIJO", category: "PULIDO_COMPLETO", fixedAmount: 180000 },
            ],
            parts: [],
        },
    },

    // 6) REFUERZO — presupuesto enviado, sin respuesta, se insistió
    {
        customerEmail: "roberto.silva@email.com",
        vehicle: { brand: "Chevrolet", model: "Cruze", year: "2018", domain: "XYZ789", secure: "Mercantil" },
        status: "refuerzo",
        notes: "No respondió desde hace 8 días. Recordatorio enviado automáticamente.",
        source: "web",
        createdDaysAgo: 12,
        budget: {
            status: "sent",
            concepts: [
                {
                    type: "DESCRIPTIVO",
                    category: "DESMONTAR_Y_REPARAR",
                    subdetails: ["lamina_paragolpe_del", "grilla_frente", "soporte_optica_izq"],
                },
                { type: "UNIDADES", category: "CHAPA", units: 1, unitValue: 420000 },
                { type: "UNIDADES", category: "PINTURA", units: 1, unitValue: 380000 },
                { type: "FIJO", category: "ALINEACION_BALANCEO", fixedAmount: 85000 },
            ],
            parts: [
                { quantity: 1, description: "Óptica izquierda Cruze (original)", unitPrice: 390000 },
                { quantity: 1, description: "Grilla frontal central", unitPrice: 95000 },
            ],
        },
    },

    // 7) GANADO — el cliente aceptó, va a producción
    {
        customerEmail: "ana.martinez@email.com",
        vehicle: { brand: "Mazda", model: "CX-5", year: "2021", domain: "MZD321", secure: "La Caja" },
        status: "ganado",
        notes: "Cliente aceptó el 14/04. Turno asignado para ingreso el 28/04.",
        source: "web",
        createdDaysAgo: 18,
        budget: {
            status: "accepted",
            concepts: [
                { type: "DESCRIPTIVO", category: "DESMONTAR", subdetails: ["tapizado_puerta_del_der", "cielorraso_interior"] },
                { type: "DESCRIPTIVO", category: "DESABOLLAR", subdetails: ["guardabarro_del_der", "panel_puerta_del_der"] },
                { type: "UNIDADES", category: "CHAPA", units: 2, unitValue: 480000 },
                { type: "UNIDADES", category: "PINTURA", units: 2, unitValue: 420000 },
                { type: "FIJO", category: "AIRBAGS", fixedAmount: 320000 },
            ],
            parts: [
                { quantity: 1, description: "Airbag lateral delantero derecho", unitPrice: 680000 },
                { quantity: 1, description: "Manija interior puerta", unitPrice: 45000 },
            ],
        },
    },

    // 8) GANADO — cliente frecuente, trabajo mediano
    {
        customerEmail: "patricia.lopez@email.com",
        vehicle: { brand: "Nissan", model: "Sentra", year: "2020", domain: "NSN202", secure: "Federación Patronal" },
        status: "ganado",
        notes: "Cliente histórico. Servicio integral post-rayón lateral.",
        createdDaysAgo: 25,
        budget: {
            status: "accepted",
            concepts: [
                { type: "DESCRIPTIVO", category: "DESMONTAR_Y_REPARAR", subdetails: ["moldura_paragolpe_tras"] },
                { type: "UNIDADES", category: "PINTURA", units: 2, unitValue: 380000 },
                { type: "FIJO", category: "PULIDO_COMPLETO", fixedAmount: 180000 },
                { type: "FIJO", category: "OTROS_ADICIONALES", fixedAmount: 85000, fixedDescription: "Limpieza y acondicionamiento interior." },
            ],
            parts: [],
        },
    },

    // 9) PERDIDO — rechazado por precio
    {
        customerEmail: "luis.fernandez@email.com",
        vehicle: { brand: "Peugeot", model: "208", year: "2019", domain: "PGT208", secure: "Mercantil" },
        status: "perdido",
        notes: "Cliente optó por taller competidor. Oportunidad de seguimiento futuro.",
        lostReason: "precio",
        lostNotes: "Precio 15% arriba de la competencia; oportunidad futura.",
        source: "web",
        createdDaysAgo: 30,
        budget: {
            status: "rejected",
            concepts: [
                { type: "DESCRIPTIVO", category: "DESABOLLAR", subdetails: ["panel_puerta_tras_izq", "panel_puerta_tras_der"] },
                { type: "UNIDADES", category: "CHAPA", units: 2, unitValue: 450000 },
                { type: "UNIDADES", category: "PINTURA", units: 2, unitValue: 400000 },
            ],
            parts: [],
        },
    },

    // 10) PERDIDO — cliente dejó de responder
    {
        customerEmail: "jorge.ramirez@email.com",
        vehicle: { brand: "Volkswagen", model: "Vento", year: "2017", domain: "VNT017", secure: "Sancor" },
        status: "perdido",
        notes: "Sin respuesta después de 3 recordatorios.",
        lostReason: "no_respondio",
        source: "whatsapp",
        createdDaysAgo: 45,
        budget: {
            status: "expired",
            concepts: [{ type: "FIJO", category: "MECANICA", fixedAmount: 450000 }],
            parts: [],
        },
    },
];

// Customers adicionales que sample-clients no crea
const EXTRA_CUSTOMERS = [
    {
        name: "Aveldaño, Pablo",
        email: "pablo.aveldano@email.com",
        phone: "+54 9 3492 155-9075",
        dni: "32415678",
        dniType: "DNI",
        city: "Rafaela",
        cp: "2300",
        address: "Cachero 964",
    },
    {
        name: "Fernández, Lucía",
        email: "lucia.fernandez@email.com",
        phone: "+54 9 11 4567-8901",
        dni: "35789012",
        dniType: "DNI",
        city: "CABA",
        cp: "1425",
        address: "Av. Santa Fe 2341",
    },
    {
        name: "Silva, Roberto",
        email: "roberto.silva@email.com",
        phone: "+54 9 221 555-1212",
        dni: "28456789",
        dniType: "DNI",
        city: "La Plata",
        cp: "1900",
        address: "Calle 50 N° 870",
    },
    {
        name: "Martínez, Ana",
        email: "ana.martinez@email.com",
        phone: "+54 9 11 3344-5566",
        dni: "33112233",
        dniType: "DNI",
        city: "Tigre",
        cp: "1648",
        address: "Cazón 1234",
    },
    {
        name: "López, Patricia",
        email: "patricia.lopez@email.com",
        phone: "+54 9 351 777-8899",
        dni: "29887766",
        dniType: "DNI",
        city: "Córdoba",
        cp: "5000",
        address: "Av. Colón 1200",
    },
    {
        name: "Fernández, Luis",
        email: "luis.fernandez@email.com",
        phone: "+54 9 11 9988-7766",
        dni: "31445566",
        dniType: "DNI",
        city: "Morón",
        cp: "1708",
        address: "Belgrano 456",
    },
    {
        name: "Ramírez, Jorge",
        email: "jorge.ramirez@email.com",
        phone: "+54 9 261 223-4455",
        dni: "27334455",
        dniType: "DNI",
        city: "Mendoza",
        cp: "5500",
        address: "San Martín 789",
    },
];

// =====================================================
// Helpers
// =====================================================

function dateDaysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
}

function mapConceptsForCreate(concepts: ConceptFixture[]) {
    return concepts.map((c, idx) => {
        const base = {
            type: c.type as ConceptType,
            category: c.category,
            order: idx,
            subdetails: c.type === "DESCRIPTIVO" ? c.subdetails : [],
            additionalDetail: c.type === "DESCRIPTIVO" ? c.additionalDetail ?? null : null,
            units: c.type === "UNIDADES" ? c.units : null,
            unitValue: c.type === "UNIDADES" ? c.unitValue : null,
            fixedAmount: c.type === "FIJO" ? c.fixedAmount : null,
            fixedDescription: c.type === "FIJO" ? c.fixedDescription ?? null : null,
            subtotal: computeConceptSubtotal({
                type: c.type,
                units: "units" in c ? c.units : null,
                unitValue: "unitValue" in c ? c.unitValue : null,
                fixedAmount: "fixedAmount" in c ? c.fixedAmount : null,
            }),
        };
        return base;
    });
}

function mapPartsForCreate(parts: PartFixture[]) {
    return parts.map((p, idx) => ({
        order: idx,
        quantity: p.quantity,
        description: p.description,
        unitPrice: p.unitPrice,
        subtotal: computePartSubtotal(p),
    }));
}

// =====================================================
// Main
// =====================================================

async function seedLeadsAndBudgets() {
    console.log("📝 Seeding leads + budgets…\n");

    console.log("🧹 Cleaning previous leads/budgets (cascade)…");
    await prisma.lead.deleteMany({}); // Budget/Concept/Part caen en cascada
    console.log("✅ Clean");

    // Garantizar que haya un país/provincia para los customers extra
    const argentina = await prisma.country.findUnique({ where: { code: "AR" } });
    const anyState = await prisma.state.findFirst({ where: { countryId: argentina?.id } });
    if (!argentina || !anyState) {
        throw new Error("Faltan seeds de countries-states. Corré `bunx tsx prisma/seed/countries-states.ts` primero.");
    }
    const customerRole = await prisma.role.findUnique({ where: { name: "customer" } });

    // Crear customers extra si no existen
    console.log("\n👥 Upserting extra customers…");
    for (const c of EXTRA_CUSTOMERS) {
        await prisma.customer.upsert({
            where: { email: c.email },
            update: {},
            create: {
                ...c,
                countryId: argentina.id,
                stateId: anyState.id,
                roleId: customerRole?.id ?? null,
            },
        });
        console.log(`   ✓ ${c.name}`);
    }

    // User que creará los leads (admin)
    const admin = await prisma.user.findUnique({ where: { email: "admin@example.com" } });

    // Contador de número de presupuesto (arranca alto para que se vea pro)
    let budgetNumber = 1001;

    console.log("\n📋 Creating leads & budgets…");
    for (const f of FIXTURES) {
        const customer = await prisma.customer.findUnique({ where: { email: f.customerEmail } });
        if (!customer) {
            console.warn(`   ⚠ Customer ${f.customerEmail} no encontrado, se saltea`);
            continue;
        }

        // Crear vehicle (siempre nuevo para este fixture — evita colisión de dominio)
        const existingVehicle = await prisma.customerVehicle.findFirst({
            where: { customerId: customer.id, domain: f.vehicle.domain },
        });
        const vehicle =
            existingVehicle ??
            (await prisma.customerVehicle.create({
                data: {
                    customerId: customer.id,
                    brand: f.vehicle.brand,
                    model: f.vehicle.model,
                    year: f.vehicle.year,
                    domain: f.vehicle.domain,
                    secure: f.vehicle.secure ?? "",
                    thirdPartySecure: f.vehicle.thirdPartySecure ?? "",
                },
            }));

        const createdAt = dateDaysAgo(f.createdDaysAgo ?? 0);

        const lead = await prisma.lead.create({
            data: {
                customerId: customer.id,
                vehicleId: vehicle.id,
                status: f.status,
                notes: f.notes ?? null,
                lostReason: f.lostReason ?? null,
                lostNotes: f.lostNotes ?? null,
                source: f.source ?? "manual",
                createdById: admin?.id ?? null,
                createdAt,
                updatedAt: createdAt,
            },
        });

        let budgetLine = "";
        if (f.budget) {
            const totals = computeBudgetTotals({
                concepts: f.budget.concepts.map((c) => ({
                    type: c.type,
                    units: "units" in c ? c.units : null,
                    unitValue: "unitValue" in c ? c.unitValue : null,
                    fixedAmount: "fixedAmount" in c ? c.fixedAmount : null,
                })),
                parts: f.budget.parts,
            });

            const number = budgetNumber++;
            const sentAt =
                f.budget.status === "sent" ||
                f.budget.status === "accepted" ||
                f.budget.status === "rejected" ||
                f.budget.status === "expired"
                    ? dateDaysAgo((f.createdDaysAgo ?? 0) - 1)
                    : null;
            const acceptedAt = f.budget.status === "accepted" ? dateDaysAgo((f.createdDaysAgo ?? 0) - 5) : null;
            const rejectedAt = f.budget.status === "rejected" ? dateDaysAgo((f.createdDaysAgo ?? 0) - 5) : null;

            await prisma.budget.create({
                data: {
                    leadId: lead.id,
                    number,
                    status: f.budget.status,
                    customerName: customer.name,
                    customerEmail: customer.email,
                    customerPhone: customer.phone,
                    customerDni: customer.dni,
                    customerAddress: customer.address,
                    vehicleBrand: vehicle.brand,
                    vehicleModel: vehicle.model,
                    vehicleYear: vehicle.year,
                    vehicleDomain: vehicle.domain,
                    vehicleInsurance: vehicle.secure,
                    validityDays: f.budget.validityDays ?? 10,
                    deliveryDays: f.budget.deliveryDays ?? 20,
                    paymentCondition: f.budget.paymentCondition ?? "Contado contra entrega",
                    observations: f.budget.observations ?? null,
                    laborSubtotal: totals.laborSubtotal,
                    ivaRate: totals.ivaRate,
                    ivaAmount: totals.ivaAmount,
                    laborTotal: totals.laborTotal,
                    partsSubtotal: totals.partsSubtotal,
                    grandTotal: totals.grandTotal,
                    sentAt,
                    acceptedAt,
                    rejectedAt,
                    createdById: admin?.id ?? null,
                    createdAt,
                    updatedAt: sentAt ?? createdAt,
                    concepts: { create: mapConceptsForCreate(f.budget.concepts) },
                    parts: { create: mapPartsForCreate(f.budget.parts) },
                },
            });
            budgetLine = ` · Presup #${number} (${f.budget.status}) ${totals.grandTotal.toLocaleString("es-AR")} ARS`;
        }

        console.log(
            `   ✓ ${customer.name.padEnd(28)} ${vehicle.brand} ${vehicle.model} [${vehicle.domain}] — ${f.status}${budgetLine}`,
        );
    }

    // Resumen final
    const [totalLeads, byStatus, totalBudgets] = await Promise.all([
        prisma.lead.count(),
        prisma.lead.groupBy({ by: ["status"], _count: true }),
        prisma.budget.count(),
    ]);

    console.log("\n📊 Summary:");
    console.log(`   Leads: ${totalLeads}`);
    for (const row of byStatus) {
        console.log(`     - ${row.status.padEnd(12)} ${row._count}`);
    }
    console.log(`   Budgets: ${totalBudgets}`);
}

seedLeadsAndBudgets()
    .catch((err) => {
        console.error("❌ Error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log("\n🔌 Disconnected");
    });
