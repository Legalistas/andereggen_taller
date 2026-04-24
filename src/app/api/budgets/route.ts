import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { BudgetStatus, Prisma } from "../../../../generated/prisma/client";

const STATUSES: BudgetStatus[] = ["draft", "sent", "accepted", "rejected", "expired"];

export async function GET(request: Request) {
    const authError = await verifyAuth(request);
    if (authError) return authError;

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const status = url.searchParams.get("status") as BudgetStatus | null;
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const amountMin = url.searchParams.get("amountMin");
    const amountMax = url.searchParams.get("amountMax");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

    const where: Prisma.BudgetWhereInput = {
        ...(status && STATUSES.includes(status) && { status }),
        ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
        ...(dateTo && {
            createdAt: {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                lte: new Date(dateTo),
            },
        }),
        ...(search && {
            OR: [
                { customerName: { contains: search, mode: "insensitive" } },
                { customerEmail: { contains: search, mode: "insensitive" } },
                { vehicleDomain: { contains: search, mode: "insensitive" } },
                { vehicleBrand: { contains: search, mode: "insensitive" } },
                { vehicleModel: { contains: search, mode: "insensitive" } },
            ],
        }),
        ...(amountMin && { grandTotal: { gte: Number(amountMin) } }),
        ...(amountMax && {
            grandTotal: {
                ...(amountMin ? { gte: Number(amountMin) } : {}),
                lte: Number(amountMax),
            },
        }),
    };

    const budgets = await prisma.budget.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            leadId: true,
            number: true,
            status: true,
            customerName: true,
            customerEmail: true,
            customerPhone: true,
            vehicleBrand: true,
            vehicleModel: true,
            vehicleYear: true,
            vehicleDomain: true,
            laborTotal: true,
            partsSubtotal: true,
            grandTotal: true,
            validityDays: true,
            sentAt: true,
            acceptedAt: true,
            rejectedAt: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return NextResponse.json({ budgets });
}
