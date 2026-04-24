import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { sendEmail } from "@/lib/email/send";
import { BudgetReminderEmail } from "@/lib/email/templates/budget-reminder";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/crm/leads/[id]/reminder
 *
 * Envía un recordatorio del último presupuesto enviado al cliente del lead
 * (si notifyOnBudgetReminder=true en settings) y pasa el estado del lead a
 * "refuerzo". La transición es idempotente — si ya está en refuerzo no rompe.
 *
 * Devuelve: { ok, emailSent, lead, budgetNumber }
 */
export async function POST(request: Request, ctx: RouteContext) {
    const authError = await verifyAuth(request);
    if (authError) return authError;
    const { id } = await ctx.params;

    const lead = await prisma.lead.findUnique({
        where: { id },
        include: {
            customer: { select: { name: true, email: true } },
            budgets: {
                where: { status: "sent" },
                orderBy: { sentAt: "desc" },
                take: 1,
            },
        },
    });
    if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

    const budget = lead.budgets[0];
    if (!budget) {
        return NextResponse.json(
            { error: "El lead no tiene presupuesto enviado para recordar." },
            { status: 400 },
        );
    }

    const settings = await getAppSettings();
    let emailSent = false;

    if (settings.notifyOnBudgetReminder && lead.customer.email) {
        try {
            const daysAgo = budget.sentAt
                ? Math.max(
                    1,
                    Math.round((Date.now() - new Date(budget.sentAt).getTime()) / 86400_000),
                )
                : settings.reminderDaysAfterSent;

            const ARS = new Intl.NumberFormat("es-AR", {
                style: "currency",
                currency: settings.currency ?? "ARS",
                maximumFractionDigits: 0,
            });

            await sendEmail({
                to: lead.customer.email,
                subject: `Recordatorio — presupuesto #${budget.number}`,
                react: BudgetReminderEmail({
                    customerName: budget.customerName,
                    budgetNumber: budget.number,
                    vehicle: `${budget.vehicleBrand} ${budget.vehicleModel} (${budget.vehicleDomain})`,
                    grandTotal: ARS.format(Number(budget.grandTotal)),
                    daysAgo,
                    actionUrl: process.env.AUTH_URL ?? "http://localhost:3000",
                }),
            });
            emailSent = true;
        } catch (err) {
            console.error("Reminder email failed:", err);
            // No abortamos; igual movemos el lead a refuerzo — el admin ve el estado actualizado.
        }
    }

    // Actualizar estado del lead (idempotente)
    const updated = await prisma.lead.update({
        where: { id },
        data: { status: "refuerzo" },
        select: { id: true, status: true, updatedAt: true },
    });

    return NextResponse.json({
        ok: true,
        emailSent,
        notifyEnabled: settings.notifyOnBudgetReminder,
        lead: updated,
        budgetNumber: budget.number,
    });
}
