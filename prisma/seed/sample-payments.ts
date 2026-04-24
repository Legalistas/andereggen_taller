/**
 * Seed de pagos de muestra sobre los presupuestos aceptados.
 * Así la pantalla /reportes/ingresos arranca con KPIs y gráficos reales.
 *
 * Estrategia:
 *  - Budget accepted #1 (Martínez) → pagado completo (50% seña + 50% al entregar)
 *  - Budget accepted #2 (López Patricia) → solo seña (parcial)
 *
 * Reruneable — limpia pagos previos antes de crear.
 */

import { prisma } from "../../src/lib/prisma";

async function seedSamplePayments() {
    console.log("💰 Seeding pagos de muestra…");

    console.log("🧹 Cleaning previous payments…");
    await prisma.payment.deleteMany({});
    console.log("✅ Clean\n");

    const admin = await prisma.user.findUnique({ where: { email: "admin@example.com" } });

    // Buscamos los budgets accepted ordenados por número para resultados reproducibles
    const accepted = await prisma.budget.findMany({
        where: { status: "accepted" },
        orderBy: { number: "asc" },
    });

    if (accepted.length === 0) {
        console.log("   ⚠ No hay budgets accepted — corré primero sample-leads-budgets.");
        return;
    }

    for (let i = 0; i < accepted.length; i++) {
        const b = accepted[i];
        const total = Number(b.grandTotal);
        const daysSinceAccepted = b.acceptedAt
            ? Math.max(1, Math.round((Date.now() - b.acceptedAt.getTime()) / 86400_000))
            : 0;

        if (i === 0) {
            // Primer accepted → pagado completo con 2 pagos (seña + saldo)
            const half = Math.round(total / 2);
            const rest = total - half;
            const senaDate = b.acceptedAt ?? new Date();
            const saldoDate = new Date(senaDate.getTime() + Math.max(1, daysSinceAccepted - 3) * 86400_000);

            await prisma.payment.createMany({
                data: [
                    {
                        budgetId: b.id,
                        amount: half,
                        paidAt: senaDate,
                        method: "TRANSFERENCIA",
                        reference: "Seña 50%",
                        notes: "Seña transferida al aceptar el presupuesto.",
                        createdById: admin?.id ?? null,
                    },
                    {
                        budgetId: b.id,
                        amount: rest,
                        paidAt: saldoDate,
                        method: "EFECTIVO",
                        reference: "Saldo al entregar",
                        notes: "Cancelación al retirar el vehículo.",
                        createdById: admin?.id ?? null,
                    },
                ],
            });
            console.log(`   ✓ #${b.number} ${b.customerName}: pagado completo (${half.toLocaleString("es-AR")} + ${rest.toLocaleString("es-AR")})`);
        } else if (i === 1) {
            // Segundo accepted → solo seña (parcial)
            const sena = Math.round(total * 0.3);
            await prisma.payment.create({
                data: {
                    budgetId: b.id,
                    amount: sena,
                    paidAt: b.acceptedAt ?? new Date(),
                    method: "MERCADOPAGO",
                    reference: "MP-28391",
                    notes: "Seña 30% por MercadoPago.",
                    createdById: admin?.id ?? null,
                },
            });
            console.log(`   ✓ #${b.number} ${b.customerName}: parcial (${sena.toLocaleString("es-AR")} / ${total.toLocaleString("es-AR")})`);
        }
        // Los demás accepted quedan sin pagos (pendientes)
    }

    const total = await prisma.payment.count();
    console.log(`\n📊 Total pagos: ${total}`);
}

seedSamplePayments()
    .catch((err) => {
        console.error("❌ Error:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
