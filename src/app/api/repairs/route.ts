import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type { RepairStatus } from "../../../../generated/prisma/client";

const ALL_STATUSES: RepairStatus[] = [
  "turno_asignado",
  "pendientes_repuestos",
  "chapa",
  "pintura",
  "calidad",
  "pendientes_cobro",
  "experiencia_cliente",
  "archivado",
];

const ACTIVE_STATUSES: RepairStatus[] = ALL_STATUSES.filter(
  (s) => s !== "archivado",
);

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const tab = url.searchParams.get("tab"); // "activas" | "archivadas" | null
  const search = url.searchParams.get("search")?.trim() ?? "";
  const statusParam = url.searchParams.get("status") as RepairStatus | null;
  const mechanicId = url.searchParams.get("mechanicId") ?? undefined;

  const statusFilter: RepairStatus[] =
    statusParam && ALL_STATUSES.includes(statusParam)
      ? [statusParam]
      : tab === "archivadas"
        ? ["archivado"]
        : tab === "activas"
          ? ACTIVE_STATUSES
          : ALL_STATUSES;

  const repairs = await prisma.repair.findMany({
    where: {
      status: { in: statusFilter },
      ...(mechanicId && { assignedMechanicId: mechanicId }),
      ...(search && {
        OR: [
          { customerName: { contains: search, mode: "insensitive" } },
          { vehicleDomain: { contains: search, mode: "insensitive" } },
          { vehicleBrand: { contains: search, mode: "insensitive" } },
          { vehicleModel: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      assignedMechanic: {
        select: { id: true, name: true, email: true, image: true },
      },
      budget: { select: { id: true, number: true, grandTotal: true } },
      lead: { select: { id: true, status: true } },
      serviceRating: {
        select: { stars: true, respondedAt: true, token: true },
      },
    },
    // El Kanban agrupa por status según el array COLUMNS de production-kanban.tsx,
    // así que el orden visual no depende del enum. Solo ordenamos por updatedAt
    // para que las cards más recientes aparezcan primero dentro de cada columna.
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ repairs });
}

/**
 * POST /api/repairs — crea una reparación directa (spec 5.1) o desde Budget.
 * Body:
 *  - Modo directo: { directCreation: true, customerId, vehicleId?, reason, ... }
 *    — usa customer+vehicle existentes y copia snapshot.
 *  - Modo desde budget: { budgetId } — crea el snapshot desde el budget aceptado.
 */
export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const {
    budgetId,
    customerId,
    vehicleId,
    newCustomer,
    newVehicle,
    reason,
    assignedMechanicId,
    scheduledAt,
    estimatedDeliveryAt,
    notes,
  } = body as {
    budgetId?: string;
    customerId?: string;
    vehicleId?: string | null;
    newCustomer?: {
      name: string;
      email: string;
      phone: string;
      dni?: string;
      dniType?: string;
    } | null;
    newVehicle?: {
      brand: string;
      model: string;
      year: string;
      domain: string;
      secure?: string;
      thirdPartySecure?: string;
    } | null;
    reason?: string;
    assignedMechanicId?: string | null;
    scheduledAt?: string | null;
    estimatedDeliveryAt?: string | null;
    notes?: string | null;
  };

  // ────── Modo desde Budget ──────
  if (budgetId) {
    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
      include: {
        lead: {
          select: { id: true, customerId: true, vehicleId: true },
        },
      },
    });
    if (!budget) {
      return NextResponse.json(
        { error: "Presupuesto no encontrado" },
        { status: 404 },
      );
    }

    const dupe = await prisma.repair.findUnique({ where: { budgetId } });
    if (dupe) {
      return NextResponse.json(
        {
          error: "Ya existe una reparación para este presupuesto",
          repair: dupe,
        },
        { status: 409 },
      );
    }

    const repair = await prisma.repair.create({
      data: {
        status: "turno_asignado",
        budgetId,
        leadId: budget.leadId,
        directCreation: false,
        customerId: budget.lead.customerId,
        vehicleId: budget.lead.vehicleId,
        customerName: budget.customerName,
        customerEmail: budget.customerEmail,
        customerPhone: budget.customerPhone,
        vehicleBrand: budget.vehicleBrand,
        vehicleModel: budget.vehicleModel,
        vehicleYear: budget.vehicleYear,
        vehicleDomain: budget.vehicleDomain,
        reason: null,
        assignedMechanicId: assignedMechanicId ?? null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        estimatedDeliveryAt: estimatedDeliveryAt
          ? new Date(estimatedDeliveryAt)
          : null,
        notes: notes ?? null,
        createdById: session?.user?.id ?? null,
      },
      include: {
        assignedMechanic: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ repair }, { status: 201 });
  }

  // ────── Modo directo (spec 5.1) ──────
  // Cubre 3 casos:
  //  a) customerId existente + vehicleId existente
  //  b) customerId existente + newVehicle (vehículo nuevo del cliente)
  //  c) newCustomer + newVehicle (cliente y vehículo nuevos)
  if (!customerId && !newCustomer) {
    return NextResponse.json(
      { error: "customerId o newCustomer son requeridos" },
      { status: 400 },
    );
  }

  // Validaciones de newCustomer / newVehicle
  if (newCustomer) {
    if (!newCustomer.name || !newCustomer.email || !newCustomer.phone) {
      return NextResponse.json(
        { error: "newCustomer requiere name, email y phone" },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomer.email.trim())) {
      return NextResponse.json(
        { error: "Email del cliente inválido" },
        { status: 400 },
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
        { error: "newVehicle requiere brand, model, year y domain" },
        { status: 400 },
      );
    }
  }
  // Si es cliente nuevo, también necesita vehículo nuevo (no hay vehicleId
  // existente posible para él).
  if (newCustomer && !newVehicle) {
    return NextResponse.json(
      { error: "Cliente nuevo requiere también newVehicle" },
      { status: 400 },
    );
  }

  // Todo en una transacción para garantizar atomicidad
  let repair: Awaited<ReturnType<typeof prisma.repair.create>>;
  try {
    repair = await prisma.$transaction(async (tx) => {
      // 1. Resolver / crear customer
      let resolvedCustomerId: string;
      let customerSnapshot: {
        name: string;
        email: string;
        phone: string;
      };

      if (newCustomer) {
        // Verificar que no exista un customer con el mismo email
        const dupe = await tx.customer.findUnique({
          where: { email: newCustomer.email.trim().toLowerCase() },
        });
        if (dupe) {
          throw new Error(
            `Ya existe un cliente con el email ${newCustomer.email}. Usá "Cliente existente".`,
          );
        }
        // Defaults de país/provincia (AR/Santa Fe/Rafaela)
        const ar =
          (await tx.country.findUnique({ where: { code: "AR" } })) ??
          (await tx.country.findFirst({ orderBy: { name: "asc" } }));
        if (!ar) throw new Error("No hay países configurados (corré seed).");
        const sf =
          (await tx.state.findFirst({
            where: { countryId: ar.id, name: "Santa Fe" },
          })) ??
          (await tx.state.findFirst({
            where: { countryId: ar.id },
            orderBy: { name: "asc" },
          }));
        if (!sf) throw new Error("No hay provincias configuradas.");

        const created = await tx.customer.create({
          data: {
            name: newCustomer.name.trim(),
            email: newCustomer.email.trim().toLowerCase(),
            phone: newCustomer.phone.trim(),
            dni: newCustomer.dni?.trim() || null,
            dniType: newCustomer.dniType?.trim() || null,
            countryId: ar.id,
            stateId: sf.id,
            city: "Rafaela",
            cp: "-",
            address: "-",
          },
        });
        resolvedCustomerId = created.id;
        customerSnapshot = {
          name: created.name,
          email: created.email,
          phone: created.phone,
        };
      } else {
        const existing = await tx.customer.findUnique({
          where: { id: customerId as string },
        });
        if (!existing) throw new Error("Cliente no existe");
        resolvedCustomerId = existing.id;
        customerSnapshot = {
          name: existing.name,
          email: existing.email,
          phone: existing.phone,
        };
      }

      // 2. Resolver / crear vehicle
      let resolvedVehicleId: string;
      let vehicleSnapshot: {
        brand: string;
        model: string;
        year: string;
        domain: string;
      };

      if (newVehicle) {
        const createdV = await tx.customerVehicle.create({
          data: {
            customerId: resolvedCustomerId,
            brand: newVehicle.brand.trim(),
            model: newVehicle.model.trim(),
            year: newVehicle.year.trim(),
            domain: newVehicle.domain.trim().toUpperCase(),
            secure: newVehicle.secure ?? "",
            thirdPartySecure: newVehicle.thirdPartySecure ?? "",
          },
        });
        resolvedVehicleId = createdV.id;
        vehicleSnapshot = {
          brand: createdV.brand,
          model: createdV.model,
          year: createdV.year,
          domain: createdV.domain,
        };
      } else {
        // Cliente existente con vehicleId opcional
        const where = vehicleId
          ? { id: vehicleId, customerId: resolvedCustomerId }
          : { customerId: resolvedCustomerId };
        const existingV = vehicleId
          ? await tx.customerVehicle.findFirst({ where })
          : await tx.customerVehicle.findFirst({
              where: { customerId: resolvedCustomerId },
              orderBy: { createdAt: "asc" },
            });
        if (!existingV) {
          throw new Error(
            vehicleId
              ? "Vehículo no pertenece al cliente"
              : "El cliente no tiene vehículos cargados",
          );
        }
        resolvedVehicleId = existingV.id;
        vehicleSnapshot = {
          brand: existingV.brand,
          model: existingV.model,
          year: existingV.year,
          domain: existingV.domain,
        };
      }

      // 3. Crear la Repair
      return tx.repair.create({
        data: {
          status: "turno_asignado",
          directCreation: true,
          customerId: resolvedCustomerId,
          vehicleId: resolvedVehicleId,
          customerName: customerSnapshot.name,
          customerEmail: customerSnapshot.email,
          customerPhone: customerSnapshot.phone,
          vehicleBrand: vehicleSnapshot.brand,
          vehicleModel: vehicleSnapshot.model,
          vehicleYear: vehicleSnapshot.year,
          vehicleDomain: vehicleSnapshot.domain,
          reason: reason?.trim() || null,
          assignedMechanicId: assignedMechanicId ?? null,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          estimatedDeliveryAt: estimatedDeliveryAt
            ? new Date(estimatedDeliveryAt)
            : null,
          notes: notes ?? null,
          createdById: session?.user?.id ?? null,
        },
        include: {
          assignedMechanic: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      });
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear" },
      { status: 400 },
    );
  }

  return NextResponse.json({ repair }, { status: 201 });
}
