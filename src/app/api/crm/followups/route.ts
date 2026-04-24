import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

/**
 * GET /api/crm/followups
 * Devuelve 5 buckets de acciones pendientes para la pantalla /crm/seguimiento.
 * Los umbrales se leen de AppSettings (reminderDaysAfterSent, etc).
 */
export async function GET(request: Request) {
    const authError = await verifyAuth(request);
    if (authError) return authError;

    const settings = await getAppSettings();
    const now = new Date();
    const reminderCutoff = new Date(now.getTime() - settings.reminderDaysAfterSent * 86400_000);
    const expiringSoonCutoff = new Date(now.getTime() + 3 * 86400_000); // próximos 3 días
    const twoDaysAgo = new Date(now.getTime() - 2 * 86400_000);

    // 1) Recordatorios pendientes: sent hace más de X días, lead aún no en refuerzo
    const remindersNeeded = await prisma.budget.findMany({
        where: {
            status: "sent",
            sentAt: { lte: reminderCutoff },
            lead: { status: { notIn: ["refuerzo", "ganado", "perdido"] } },
        },
        orderBy: { sentAt: "asc" },
        take: 50,
        select: {
            id: true,
            number: true,
            customerName: true,
            customerEmail: true,
            vehicleBrand: true,
            vehicleModel: true,
            vehicleDomain: true,
            grandTotal: true,
            validityDays: true,
            sentAt: true,
            leadId: true,
            lead: { select: { id: true, status: true } },
        },
    });

    // 2) En refuerzo: leads con estado "refuerzo" con su último budget
    const inReinforcementLeads = await prisma.lead.findMany({
        where: { status: "refuerzo" },
        orderBy: { updatedAt: "asc" },
        take: 50,
        include: {
            customer: { select: { id: true, name: true, email: true, phone: true } },
            vehicle: { select: { id: true, brand: true, model: true, domain: true } },
            budgets: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { id: true, number: true, grandTotal: true, sentAt: true, status: true },
            },
        },
    });

    // 3) Por vencer: sent cuya validez se agota en ≤3 días o ya vencida
    const expiringCandidates = await prisma.budget.findMany({
        where: { status: "sent", sentAt: { not: null } },
        select: {
            id: true,
            number: true,
            customerName: true,
            vehicleBrand: true,
            vehicleModel: true,
            vehicleDomain: true,
            grandTotal: true,
            validityDays: true,
            sentAt: true,
            leadId: true,
        },
    });
    const expiringSoon = expiringCandidates
        .map((b) => {
            const sentAt = b.sentAt ? new Date(b.sentAt) : null;
            if (!sentAt) return null;
            const expiresAt = new Date(sentAt.getTime() + b.validityDays * 86400_000);
            return { ...b, expiresAt: expiresAt.toISOString() };
        })
        .filter(
            (b): b is NonNullable<typeof b> =>
                b !== null && new Date(b.expiresAt) <= expiringSoonCutoff,
        )
        .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
        .slice(0, 50);

    // 4) Leads sin presupuesto: solicitud/control creados hace > 2 días, 0 budgets
    const leadsWithoutBudget = await prisma.lead.findMany({
        where: {
            status: { in: ["solicitud", "control"] },
            createdAt: { lte: twoDaysAgo },
            budgets: { none: {} },
        },
        orderBy: { createdAt: "asc" },
        take: 50,
        include: {
            customer: { select: { id: true, name: true, email: true, phone: true } },
            vehicle: { select: { id: true, brand: true, model: true, domain: true } },
        },
    });

    // 5) Borradores pendientes: budgets draft hace > 2 días
    const draftsPending = await prisma.budget.findMany({
        where: { status: "draft", createdAt: { lte: twoDaysAgo } },
        orderBy: { createdAt: "asc" },
        take: 50,
        select: {
            id: true,
            number: true,
            customerName: true,
            vehicleBrand: true,
            vehicleModel: true,
            vehicleDomain: true,
            grandTotal: true,
            createdAt: true,
            leadId: true,
        },
    });

    return NextResponse.json({
        thresholds: {
            reminderDaysAfterSent: settings.reminderDaysAfterSent,
            expiringWithinDays: 3,
            idleDaysThreshold: 2,
        },
        remindersNeeded,
        inReinforcement: inReinforcementLeads,
        expiringSoon,
        leadsWithoutBudget,
        draftsPending,
        totalActions:
            remindersNeeded.length +
            inReinforcementLeads.length +
            expiringSoon.length +
            leadsWithoutBudget.length +
            draftsPending.length,
    });
}
