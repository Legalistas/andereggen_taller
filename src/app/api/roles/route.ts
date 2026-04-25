import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const roles = await prisma.role.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ roles });
}
