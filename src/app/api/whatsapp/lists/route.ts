/**
 * GET  /api/whatsapp/lists — listas de difusión del Taller.
 * POST /api/whatsapp/lists { name }
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const lists = await prisma.whatsappList.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
  });
  return NextResponse.json({ data: lists });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Poné un nombre." }, { status: 400 });
  }
  const list = await prisma.whatsappList.create({
    data: { name: name.slice(0, 150) },
    select: { id: true },
  });
  return NextResponse.json(list, { status: 201 });
}
