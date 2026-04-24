import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const authError = await verifyAuth(request);
    if (authError) return authError;

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const role = url.searchParams.get("role") ?? "all";

    const users = await prisma.user.findMany({
        where: {
            ...(search && {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                ],
            }),
            ...(role !== "all" && { role: { name: role } }),
        },
        include: {
            role: { select: { id: true, name: true } },
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    // No devolvemos password ni accounts
    const safe = users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        isActive: u.isActive,
        role: u.role,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
    }));

    return NextResponse.json({ users: safe });
}
