import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { LeadLostReason, LeadStatus } from "../../../../../../generated/prisma/client";

const ALL_STATUSES: LeadStatus[] = [
  "solicitud",
  "control",
  "enviado",
  "refuerzo",
  "ganado",
  "perdido",
];
const LOST_REASONS: LeadLostReason[] = [
  "precio",
  "demora",
  "no_respondio",
  "competencia",
  "otro",
];

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          country: { select: { id: true, name: true, code: true } },
          state: { select: { id: true, name: true } },
        },
      },
      vehicle: true,
      budgets: {
        orderBy: { createdAt: "desc" },
        include: {
          concepts: { orderBy: { order: "asc" } },
          parts: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  return NextResponse.json({ lead });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { status, notes, lostReason, lostNotes, vehicleId } = body as {
    status?: LeadStatus;
    notes?: string | null;
    lostReason?: LeadLostReason | null;
    lostNotes?: string | null;
    vehicleId?: string | null;
  };

  if (status && !ALL_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (lostReason && !LOST_REASONS.includes(lostReason)) {
    return NextResponse.json({ error: "Invalid lostReason" }, { status: 400 });
  }

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(notes !== undefined && { notes }),
      ...(lostReason !== undefined && { lostReason }),
      ...(lostNotes !== undefined && { lostNotes }),
      ...(vehicleId !== undefined && { vehicleId }),
    },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      vehicle: { select: { id: true, brand: true, model: true, year: true, domain: true } },
    },
  });

  return NextResponse.json({ lead });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
