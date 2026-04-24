import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const authError = await verifyAuth(request);
    if (authError) return authError;

    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active") === "1";

    const sources = await prisma.leadSource.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        orderBy: [{ order: "asc" }, { label: "asc" }],
    });

    return NextResponse.json({ sources });
}

export async function POST(request: Request) {
    const authError = await verifyAuth(request, ["admin"]);
    if (authError) return authError;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const { key, label, order, isActive } = body as Record<string, unknown>;

    if (!key || typeof key !== "string") {
        return NextResponse.json({ error: "key es obligatoria" }, { status: 400 });
    }
    if (!label || typeof label !== "string") {
        return NextResponse.json({ error: "label es obligatorio" }, { status: 400 });
    }

    const slug = key
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");

    const existing = await prisma.leadSource.findUnique({ where: { key: slug } });
    if (existing) {
        return NextResponse.json({ error: "Ya existe una fuente con esa key" }, { status: 409 });
    }

    const source = await prisma.leadSource.create({
        data: {
            key: slug,
            label,
            order: Number(order ?? 100),
            isActive: isActive === undefined ? true : Boolean(isActive),
        },
    });

    return NextResponse.json({ source }, { status: 201 });
}
