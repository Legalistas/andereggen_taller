/**
 * Notificaciones automáticas — spec sección 6.
 *
 * Resuelve los destinatarios según el evento y envía el mail correspondiente.
 * Respeta los toggles globales en AppSettings:
 *   - notifyBudgetCreated, notifyVehicleEntered, notifyPartsReceived,
 *     notifyRepairCompleted, notifyCustomerExperience.
 *
 * Errores en envíos individuales NO rompen el flujo — se logean y la
 * función devuelve el resumen de qué se mandó y a quién.
 */

import { sendEmail } from "@/lib/email/send";
import {
  RepairEventEmail,
  type RepairEventType,
} from "@/lib/email/templates/repair-event";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

type EventActorMatrix = Record<
  RepairEventType,
  Array<"customer" | "inspector" | "insurance">
>;

// Spec sección 6 (v1) + spec 2.1/1.3 v2 — quién recibe cada evento
export const EVENT_RECIPIENTS: EventActorMatrix = {
  budget_created: ["customer", "inspector", "insurance"],
  vehicle_entered: ["customer", "insurance"],
  parts_received: ["inspector", "insurance"],
  repair_completed: ["customer", "inspector", "insurance"],
  customer_experience: ["customer"],
  // spec 2.1 v2 · Cliente confirma el turno; inspector/productor quedan al tanto.
  turn_assigned: ["customer", "inspector", "insurance"],
  // spec 1.3 v2 · Refuerzo comercial — sólo al cliente.
  lead_reinforcement: ["customer"],
};

const SUBJECTS: Record<RepairEventType, string> = {
  budget_created: "Tu presupuesto está listo",
  vehicle_entered: "Tu vehículo ingresó al taller",
  parts_received: "Repuestos recibidos",
  repair_completed: "Tu vehículo está listo para retirar",
  customer_experience: "¿Cómo fue tu experiencia?",
  turn_assigned: "Turno confirmado",
  lead_reinforcement: "¿Coordinamos tu reparación?",
};

const SETTINGS_FLAG: Record<
  RepairEventType,
  keyof Awaited<ReturnType<typeof getAppSettings>>
> = {
  budget_created: "notifyBudgetCreated",
  vehicle_entered: "notifyVehicleEntered",
  parts_received: "notifyPartsReceived",
  repair_completed: "notifyRepairCompleted",
  customer_experience: "notifyCustomerExperience",
  turn_assigned: "notifyTurnAssigned",
  lead_reinforcement: "notifyLeadReinforcement",
};

type Actor = {
  role: "customer" | "inspector" | "insurance";
  name: string | null;
  email: string;
};

type RepairContext = {
  customerName: string;
  customerEmail: string;
  vehicleSummary: string;
  inspector: { name: string | null; email: string | null } | null;
  insuranceAgent: { name: string | null; email: string | null } | null;
  budgetNumber?: number;
  budgetTotal?: string;
  surveyUrl?: string;
  /** spec 2.1 v2 · Fecha/hora del turno ya formateada en es-AR (para
   *  turn_assigned). */
  turnDateFormatted?: string;
};

type SendResult = {
  event: RepairEventType;
  enabled: boolean;
  sent: Array<{
    role: Actor["role"];
    email: string;
    ok: boolean;
    error?: string;
  }>;
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

/** Resuelve los destinatarios del evento que tengan email válido. */
function resolveActors(event: RepairEventType, ctx: RepairContext): Actor[] {
  const wanted = EVENT_RECIPIENTS[event];
  const actors: Actor[] = [];

  if (wanted.includes("customer") && ctx.customerEmail) {
    actors.push({
      role: "customer",
      name: ctx.customerName,
      email: ctx.customerEmail,
    });
  }
  if (wanted.includes("inspector") && ctx.inspector?.email) {
    actors.push({
      role: "inspector",
      name: ctx.inspector.name,
      email: ctx.inspector.email,
    });
  }
  if (wanted.includes("insurance") && ctx.insuranceAgent?.email) {
    actors.push({
      role: "insurance",
      name: ctx.insuranceAgent.name,
      email: ctx.insuranceAgent.email,
    });
  }
  return actors;
}

/**
 * Envía el mail del evento a los destinatarios correspondientes.
 * No tira excepciones — captura errores por destinatario.
 */
export async function sendRepairEventNotification(
  event: RepairEventType,
  ctx: RepairContext,
): Promise<SendResult> {
  const settings = await getAppSettings();
  const enabled = Boolean(settings[SETTINGS_FLAG[event]]);
  if (!enabled) {
    return { event, enabled: false, sent: [] };
  }

  const actors = resolveActors(event, ctx);
  const taller = {
    name: settings.companyName,
    phone: settings.companyPhone ?? "",
    email: settings.companyEmail ?? "",
  };

  const subject = SUBJECTS[event];
  const sent: SendResult["sent"] = [];

  for (const actor of actors) {
    try {
      await sendEmail({
        to: actor.email,
        subject,
        react: (
          <RepairEventEmail
            event={event}
            role={actor.role}
            recipientName={actor.name}
            customerName={ctx.customerName}
            vehicleSummary={ctx.vehicleSummary}
            budgetNumber={ctx.budgetNumber}
            budgetTotal={ctx.budgetTotal}
            surveyUrl={ctx.surveyUrl}
            turnDateFormatted={ctx.turnDateFormatted}
            taller={taller}
          />
        ),
      });
      sent.push({ role: actor.role, email: actor.email, ok: true });
    } catch (e) {
      console.error(
        `[notifications] Falló envío ${event} → ${actor.email}:`,
        e,
      );
      sent.push({
        role: actor.role,
        email: actor.email,
        ok: false,
        error: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }

  return { event, enabled: true, sent };
}

// ─────────────────────────────────────────────────────────────
// Helpers para construir el RepairContext desde la DB
// ─────────────────────────────────────────────────────────────

/**
 * Carga el contexto desde un Repair (usado por los triggers de status).
 * Si el Repair tiene leadId, intenta resolver inspector/productor desde
 * el lead; si no, devuelve null en esos campos (cliente único destinatario).
 */
export async function buildRepairContext(repairId: string) {
  const repair = await prisma.repair.findUnique({
    where: { id: repairId },
    include: {
      budget: { select: { number: true, grandTotal: true } },
      lead: {
        select: {
          inspector: { select: { name: true, email: true } },
          insuranceAgent: { select: { name: true, email: true } },
        },
      },
      serviceRating: { select: { token: true } },
    },
  });
  if (!repair) return null;

  // URL pública de la encuesta (E2.B). Solo se llena si existe ya un
  // ServiceRating creado para esta reparación.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "";
  const surveyUrl = repair.serviceRating?.token
    ? `${baseUrl}/reviews/${repair.serviceRating.token}`
    : undefined;

  // spec 2.1 v2 · Formateo de fecha/hora del turno para el mail
  // turn_assigned. Si el repair no tiene scheduledAt cargado, queda
  // undefined y el template usa el copy sin fecha.
  const turnDateFormatted = repair.scheduledAt
    ? new Intl.DateTimeFormat("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(repair.scheduledAt)
    : undefined;

  const ctx: RepairContext = {
    customerName: repair.customerName,
    customerEmail: repair.customerEmail,
    vehicleSummary: `${repair.vehicleBrand} ${repair.vehicleModel} ${repair.vehicleYear} · ${repair.vehicleDomain}`,
    inspector: repair.lead?.inspector ?? null,
    insuranceAgent: repair.lead?.insuranceAgent ?? null,
    budgetNumber: repair.budget?.number,
    budgetTotal: repair.budget
      ? ARS.format(Number(repair.budget.grandTotal))
      : undefined,
    surveyUrl,
    turnDateFormatted,
  };
  return ctx;
}

/**
 * Construye el contexto desde un Lead (para eventos previos a que exista
 * Repair, como spec 1.3 v2 · "Refuerzo"). Si el lead no tiene vehículo
 * ligado devuelve null porque el copy del mail asume vehicleSummary.
 */
export async function buildLeadContext(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      customer: { select: { name: true, email: true } },
      vehicle: {
        select: { brand: true, model: true, year: true, domain: true },
      },
      inspector: { select: { name: true, email: true } },
      insuranceAgent: { select: { name: true, email: true } },
    },
  });
  if (!lead?.customer?.email || !lead.vehicle) return null;

  const ctx: RepairContext = {
    customerName: lead.customer.name,
    customerEmail: lead.customer.email,
    vehicleSummary: `${lead.vehicle.brand} ${lead.vehicle.model} ${lead.vehicle.year} · ${lead.vehicle.domain}`,
    inspector: lead.inspector ?? null,
    insuranceAgent: lead.insuranceAgent ?? null,
  };
  return ctx;
}

/** Construye el contexto desde un Budget (para el evento budget_created). */
export async function buildBudgetContext(budgetId: string) {
  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
    include: {
      lead: {
        select: {
          inspector: { select: { name: true, email: true } },
          insuranceAgent: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!budget) return null;

  const ctx: RepairContext = {
    customerName: budget.customerName,
    customerEmail: budget.customerEmail,
    vehicleSummary: `${budget.vehicleBrand} ${budget.vehicleModel} ${budget.vehicleYear} · ${budget.vehicleDomain}`,
    inspector: budget.lead.inspector ?? null,
    insuranceAgent: budget.lead.insuranceAgent ?? null,
    budgetNumber: budget.number,
    budgetTotal: ARS.format(Number(budget.grandTotal)),
  };
  return ctx;
}
