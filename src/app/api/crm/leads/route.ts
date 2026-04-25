import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "../../../../../generated/prisma/client";

const ACTIVE_STATUSES: LeadStatus[] = [
  "solicitud",
  "control",
  "enviado",
  "refuerzo",
  "pendientes_cobro",
];
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
      vehicle: {
        select: {
          id: true,
          brand: true,
          model: true,
          year: true,
          domain: true,
        },
      },
      inspector: { select: { id: true, name: true, email: true, image: true } },
      insuranceAgent: {
        select: { id: true, name: true, email: true, image: true },
      },
      budgets: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          number: true,
          status: true,
          grandTotal: true,
          updatedAt: true,
        },
      },
      repairs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ leads });
}

export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    customerId,
    newCustomer,
    vehicleId,
    newVehicle,
    status,
    notes,
    source,
  } = body as {
    customerId?: string;
    newCustomer?: {
      name: string;
      email: string;
      phone: string;
      dni?: string;
      dniType?: string;
      // Dirección: opcional. Si falta, se completa con defaults (AR/Santa Fe/Rafaela/"-").
      countryId?: string;
      stateId?: string;
      city?: string;
      cp?: string;
      address?: string;
    } | null;
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

  if (!customerId && !newCustomer) {
    return NextResponse.json(
      { error: "customerId o newCustomer son requeridos" },
      { status: 400 },
    );
  }
  if (status && !ALL_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Validación: si es cliente existente, debe existir
  if (customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }
  }

  // Validación: si es cliente nuevo, datos obligatorios + email único
  if (newCustomer) {
    if (!newCustomer.name || !newCustomer.email || !newCustomer.phone) {
      return NextResponse.json(
        { error: "newCustomer requiere name, email y phone" },
        { status: 400 },
      );
    }
    const dupe = await prisma.customer.findUnique({
      where: { email: newCustomer.email },
    });
    if (dupe) {
      return NextResponse.json(
        {
          error: `Ya existe un cliente con el email ${newCustomer.email}. Buscálo en "Cliente existente".`,
        },
        { status: 409 },
      );
    }
  }

  // Validación: vehículo existente debe ser del cliente existente
  if (customerId && vehicleId) {
    const vehicle = await prisma.customerVehicle.findFirst({
      where: { id: vehicleId, customerId },
    });
    if (!vehicle) {
      return NextResponse.json(
        { error: "Vehicle not found for this customer" },
        { status: 404 },
      );
    }
  }

  if (newVehicle) {
    if (
      !newVehicle.brand ||
      !newVehicle.model ||
      !newVehicle.year ||
      !newVehicle.domain
    ) {
      return NextResponse.json(
        { error: "newVehicle requires brand, model, year, domain" },
        { status: 400 },
      );
    }
  }

  // Cliente nuevo sin vehículo → error (la cotización necesita un vehículo)
  if (newCustomer && !newVehicle && !vehicleId) {
    return NextResponse.json(
      { error: "Debés cargar un vehículo para el cliente nuevo" },
      { status: 400 },
    );
  }

  const lead = await prisma.$transaction(async (tx) => {
    // 1. Resolver o crear customer
    let finalCustomerId = customerId;
    if (!finalCustomerId && newCustomer) {
      // Defaults de dirección: buscar Argentina + Santa Fe si no vienen.
      // Si no existen, tomamos el primer país/provincia disponibles.
      let countryId = newCustomer.countryId;
      let stateId = newCustomer.stateId;
      if (!countryId) {
        const ar =
          (await tx.country.findUnique({ where: { code: "AR" } })) ??
          (await tx.country.findFirst({ orderBy: { name: "asc" } }));
        countryId = ar?.id;
      }
      if (!stateId && countryId) {
        const sf =
          (await tx.state.findFirst({
            where: { countryId, name: "Santa Fe" },
          })) ??
          (await tx.state.findFirst({
            where: { countryId },
            orderBy: { name: "asc" },
          }));
        stateId = sf?.id;
      }
      if (!countryId || !stateId) {
        throw new Error(
          "No hay países/provincias configurados. Corré el seed countries-states primero.",
        );
      }

      const created = await tx.customer.create({
        data: {
          name: newCustomer.name.trim(),
          email: newCustomer.email.trim().toLowerCase(),
          phone: newCustomer.phone.trim(),
          dni: newCustomer.dni?.trim() || null,
          dniType: newCustomer.dniType?.trim() || null,
          countryId,
          stateId,
          city: newCustomer.city?.trim() || "Rafaela",
          cp: newCustomer.cp?.trim() || "-",
          address: newCustomer.address?.trim() || "-",
        },
      });
      finalCustomerId = created.id;
    }

    // 2. Resolver o crear vehicle (con el customer ya asegurado)
    let finalVehicleId: string | null = vehicleId ?? null;
    if (!finalVehicleId && newVehicle && finalCustomerId) {
      const createdVehicle = await tx.customerVehicle.create({
        data: {
          customerId: finalCustomerId,
          brand: newVehicle.brand,
          model: newVehicle.model,
          year: newVehicle.year,
          domain: newVehicle.domain,
          secure: newVehicle.secure ?? "",
          thirdPartySecure: newVehicle.thirdPartySecure ?? "",
        },
      });
      finalVehicleId = createdVehicle.id;
    }

    // 3. Crear lead
    if (!finalCustomerId) {
      throw new Error("No se pudo resolver el customerId.");
    }
    return tx.lead.create({
      data: {
        customerId: finalCustomerId,
        vehicleId: finalVehicleId,
        status: status ?? "solicitud",
        notes: notes ?? null,
        source: source ?? null,
        createdById: session?.user?.id ?? null,
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            domain: true,
          },
        },
        budgets: true,
      },
    });
  });

  return NextResponse.json({ lead }, { status: 201 });
}
