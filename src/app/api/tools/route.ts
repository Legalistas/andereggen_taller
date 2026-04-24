import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { Prisma, ToolCategory, ToolStatus } from "../../../../generated/prisma/client";

const CATEGORIES: ToolCategory[] = [
    "NEUMATICA",
    "HIDRAULICA",
    "ELECTRICA",
    "MANUAL",
    "ELEVACION",
    "SOLDADURA",
    "PINTURA",
    "DIAGNOSTICO",
    "OTROS",
];

const STATUSES: ToolStatus[] = ["AVAILABLE", "IN_USE", "MAINTENANCE", "RETIRED"];

export async function GET(request: Request) {
    const authError = await verifyAuth(request);
    if (authError) return authError;

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const category = url.searchParams.get("category") as ToolCategory | null;
    const status = url.searchParams.get("status") as ToolStatus | null;
    const activeOnly = url.searchParams.get("active") === "1";
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);

    const where: Prisma.ToolWhereInput = {
        ...(search && {
            OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
                { brand: { contains: search, mode: "insensitive" } },
                { location: { contains: search, mode: "insensitive" } },
            ],
        }),
        ...(category && CATEGORIES.includes(category) && { category }),
        ...(status && STATUSES.includes(status) && { status }),
        ...(activeOnly && { isActive: true }),
    };

    const tools = await prisma.tool.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        take: limit,
        include: {
            assignedTo: { select: { id: true, name: true, email: true } },
        },
    });

    return NextResponse.json({ tools });
}

export async function POST(request: Request) {
    const authError = await verifyAuth(request);
    if (authError) return authError;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const {
        code,
        name,
        description,
        brand,
        category,
        status,
        location,
        cost,
        acquiredAt,
        notes,
        isActive,
    } = body as Record<string, unknown>;

    if (!name || typeof name !== "string") {
        return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }
    if (category && !CATEGORIES.includes(category as ToolCategory)) {
        return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }
    if (status && !STATUSES.includes(status as ToolStatus)) {
        return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    if (code && typeof code === "string") {
        const exists = await prisma.tool.findUnique({ where: { code } });
        if (exists) {
            return NextResponse.json(
                { error: "Ya existe una herramienta con ese código" },
                { status: 409 },
            );
        }
    }

    const tool = await prisma.tool.create({
        data: {
            code: (code as string) || null,
            name,
            description: (description as string) || null,
            brand: (brand as string) || null,
            category: (category as ToolCategory) ?? "OTROS",
            status: (status as ToolStatus) ?? "AVAILABLE",
            location: (location as string) || null,
            cost: Number(cost ?? 0),
            acquiredAt: acquiredAt ? new Date(acquiredAt as string) : null,
            notes: (notes as string) || null,
            isActive: isActive === undefined ? true : Boolean(isActive),
        },
    });

    return NextResponse.json({ tool }, { status: 201 });
}
