import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "../../../../../generated/prisma/client";

const ACTIVE_STATUSES: LeadStatus[] = ["solicitud", "control", "enviado", "refuerzo"];
const CLOSED_STATUSES: LeadStatus[] = ["ganado", "perdido"];
const ALL_STATUSES: LeadStatus[] = [...ACTIVE_STATUSES, ...CLOSED_STATUSES];

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const tab = url.searchParams.get("tab"); // "activas" | "cerradas" | null
  const search = url.searchParams.get("search")?.trim() ?? "";
  const statusParam = url.searchParams.get("status") as LeadStatus | null;

  const statusFilter: LeadStatus[] =
    statusParam && ALL_STATUSES.includes(statusParam)
      ? [statusParam]
      : tab === "cerradas"
        ? CLOSED_STATUSES
        : tab === "activas"
          ? ACTIVE_STATUSES
          : ALL_STATUSES;

  const leads = await prisma.lead.findMany({
    where: {
      status: { in: statusFilter },
      ...(search && {
        OR: [
          { customer: { name: { contains: search, mode: "insensitive" } } },
          { customer: { email: { contains: search, mode: "insensitive" } } },
          { vehicle: { domain: { contains: search, mode: "insensitive" } } },
          { vehicle: { brand: { contains: search, mode: "insensitive" } } },
          { vehicle: { model: { contains: search, mode: "insensitive" } } },
        ],
      }),
    },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      vehicle: { select: { id: true, brand: true, model: true, year: true, domain: true } },
      budgets: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, number: true, status: true, grandTotal: true, updatedAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ leads });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await auth();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { customerId, vehicleId, newVehicle, status, notes, source } = body as {
    customerId?: string;
    vehicleId?: string | null;
    newVehicle?: {
      brand: string;
      model: string;
      year: string;
      domain: string;
      secure?: string;
      thirdPartySecure?: string;
    } | null;
    status?: LeadStatus;
    notes?: string | null;
    source?: string | null;
  };

  if (!customerId) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  }
  if (status && !ALL_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  if (vehicleId) {
    const vehicle = await prisma.customerVehicle.findFirst({
      where: { id: vehicleId, customerId },
    });
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found for this customer" }, { status: 404 });
    }
  } else if (newVehicle) {
    if (!newVehicle.brand || !newVehicle.model || !newVehicle.year || !newVehicle.domain) {
      return NextResponse.json(
        { error: "newVehicle requires brand, model, year, domain" },
        { status: 400 },
      );
    }
  }

  const lead = await prisma.$transaction(async (tx) => {
    let finalVehicleId: string | null = vehicleId ?? null;
    if (!finalVehicleId && newVehicle) {
      const created = await tx.customerVehicle.create({
        data: {
          customerId,
          brand: newVehicle.brand,
          model: newVehicle.model,
          year: newVehicle.year,
          domain: newVehicle.domain,
          secure: newVehicle.secure ?? "",
          thirdPartySecure: newVehicle.thirdPartySecure ?? "",
        },
      });
      finalVehicleId = created.id;
    }

    return tx.lead.create({
      data: {
        customerId,
        vehicleId: finalVehicleId,
        status: status ?? "solicitud",
        notes: notes ?? null,
        source: source ?? null,
        createdById: session?.user?.id ?? null,
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        vehicle: { select: { id: true, brand: true, model: true, year: true, domain: true } },
        budgets: true,
      },
    });
  });

  return NextResponse.json({ lead }, { status: 201 });
}
