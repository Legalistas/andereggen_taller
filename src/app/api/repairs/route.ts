import { NextResponse } from "next/server";
import { getServerSession, verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import type {
  Prisma,
  RepairStatus,
} from "../../../../generated/prisma/client";

/**
 * Próximo Nº interno para una nueva Repair (max+1, global).
 * Acepta `tx` para usarlo dentro de una transacción y mantener atomicidad.
 */
async function nextRepairInternalNumber(
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const agg = await tx.repair.aggregate({ _max: { internalNumber: true } });
  return (agg._max.internalNumber ?? 0) + 1;
}

const ALL_STATUSES: RepairStatus[] = [
  "turno_a_asignar",
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
      // El color sale de la ficha viva del vehículo (no del snapshot): la
      // Lista completa lo muestra porque en el taller identifican el auto
      // por color antes que por patente.
      vehicle: { select: { color: true } },
      // Siniestros: la lista suma los presupuestos de todos y muestra cuántos
      // hay, para que una tarjeta con dos siniestros no parezca una sola.
      claims: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          claimNumber: true,
          approvedLabor: true,
          approvedParts: true,
          budget: {
            select: {
              id: true,
              number: true,
              grandTotal: true,
              extensions: {
                where: { status: "accepted" },
                select: { grandTotal: true },
              },
            },
          },
        },
      },
    },
    // El Kanban agrupa por status según el array COLUMNS de production-kanban.tsx,
    // así que el orden visual no depende del enum. Solo ordenamos por updatedAt
    // para que las cards más recientes aparezcan primero dentro de cada columna.
    orderBy: { updatedAt: "desc" },
  });

  // Perf audit: `pendingAmount` solo se muestra en las cards con status
  // "pendientes_cobro". Antes traíamos invoices+payments para TODOS los
  // repairs (Nº invoices × Nº pagos por card). Ahora: 2 aggregate queries
  // solo sobre los pendientes_cobro visibles.
  const pendingIds = repairs
    .filter((r) => r.status === "pendientes_cobro")
    .map((r) => r.id);

  const pendingByRepair = new Map<string, number>();
  if (pendingIds.length > 0) {
    const [billed, paid] = await Promise.all([
      prisma.repairInvoice.groupBy({
        by: ["repairId"],
        where: { repairId: { in: pendingIds } },
        _sum: { amount: true },
      }),
      prisma.$queryRaw<Array<{ repairId: string; total: number }>>`
        SELECT i."repairId", COALESCE(SUM(p.amount), 0)::float AS total
        FROM "RepairInvoice" i
        JOIN "RepairInvoicePayment" p ON p."invoiceId" = i.id
        WHERE i."repairId" = ANY(${pendingIds})
        GROUP BY i."repairId"
      `,
    ]);
    const paidByRepair = new Map(paid.map((p) => [p.repairId, p.total]));
    for (const b of billed) {
      const amt = Number(b._sum.amount ?? 0);
      pendingByRepair.set(
        b.repairId,
        amt - (paidByRepair.get(b.repairId) ?? 0),
      );
    }
  }

  const repairsWithPending = repairs.map((rest) => {
    const hasApproval =
      rest.approvedInsurance !== null ||
      rest.approvedFranchise !== null ||
      rest.approvedCustomer !== null;
    const approvedTotal = hasApproval
      ? Number(rest.approvedInsurance ?? 0) +
        Number(rest.approvedFranchise ?? 0) +
        Number(rest.approvedCustomer ?? 0)
      : null;

    // Total presupuestado de la tarjeta = suma de los presupuestos de todos
    // sus siniestros. Fallback al presupuesto principal para tarjetas viejas
    // que todavía no tienen siniestros cargados.
    const claimBudgets = rest.claims
      .map((c) => c.budget)
      .filter((b): b is NonNullable<typeof b> => b !== null);
    const budgetsTotal =
      claimBudgets.length > 0
        ? claimBudgets.reduce(
            (acc, b) =>
              acc +
              Number(b.grandTotal) +
              b.extensions.reduce((s, e) => s + Number(e.grandTotal), 0),
            0,
          )
        : rest.budget
          ? Number(rest.budget.grandTotal)
          : null;

    return {
      ...rest,
      vehicleColor: rest.vehicle?.color ?? null,
      pendingAmount: pendingByRepair.get(rest.id) ?? null,
      approvedTotal,
      budgetsTotal,
      claimCount: rest.claims.length,
    };
  });

  return NextResponse.json({ repairs: repairsWithPending });
}

/**
 * POST /api/repairs — crea la reparación a partir de un presupuesto ganado.
 * Body: { budgetId, assignedMechanicId?, scheduledAt?, estimatedDeliveryAt?, notes? }
 *
 * spec Producción v6 · El modo directo (sin presupuesto) se dio de baja: todo
 * ingreso, incluso por grúa, se carga como cotización y pasa por Ganado.
 */
export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const session = await getServerSession();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { budgetId, assignedMechanicId, scheduledAt, estimatedDeliveryAt, notes } =
    body as {
      budgetId?: string;
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

    const internalNumber = await nextRepairInternalNumber();
    const repair = await prisma.repair.create({
      data: {
        // spec Producción v4 · La tarjeta nace con su "Siniestro 1" ya
        // vinculado al presupuesto. Los importes quedan vacíos porque son los
        // APROBADOS por el seguro, que casi nunca coinciden con lo
        // presupuestado; la ficha ofrece copiarlos con un botón.
        claims: { create: { order: 1, budgetId } },
        // spec 2.1 v2 · Si el caller ya coordinó fecha con el cliente
        // (mandó scheduledAt), arranca directo en "turno_asignado";
        // si no, queda en "turno_a_asignar" hasta que el equipo cargue
        // la fecha.
        status: scheduledAt ? "turno_asignado" : "turno_a_asignar",
        internalNumber,
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
        insuranceCompany: budget.vehicleInsurance,
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

  // spec Producción v6 · La creación directa se dio de baja: todo ingreso,
  // incluso por grúa, entra como cotización y llega acá al ganarse. Si no, se
  // duplican vehículos y se rompen las estadísticas de oportunidades ganadas.
  return NextResponse.json(
    {
      error:
        "Las reparaciones se crean desde Cotizaciones al ganar la oportunidad. Cargá el ingreso como una cotización (aunque sea provisoria).",
    },
    { status: 410 },
  );
}
