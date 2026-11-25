/**
 * Avisos automáticos — "Requerimientos de automatizaciones v1.3".
 *
 * Resuelve los destinatarios según el evento, envía el mail (y al cliente el
 * WhatsApp con el mismo aviso) y deja cada intento en NotificationLog: qué se
 * mandó, por qué canal, a quién y por qué falló. Es la línea de tiempo de
 * avisos de la ficha. Respeta los toggles de AppSettings (ver SETTINGS_FLAG);
 * el WhatsApp además necesita Configuración → Integraciones → WhatsApp.
 *
 * Errores en envíos individuales NO rompen el flujo — se registran y la
 * función devuelve el resumen de qué se mandó y a quién.
 */

import { after } from "next/server";
import { sendEmail } from "@/lib/email/send";
import {
  type DayTime,
  eventSubject,
  type NotifyEvent,
  RepairEventEmail,
  type RepairEventType,
  type Role,
} from "@/lib/email/templates/repair-event";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { waIdArgentina } from "@/lib/whatsapp/parse";
import {
  sendWhatsapp,
  templateByName,
  upsertContact,
} from "@/lib/whatsapp/twilio";
import type { LeadStatus } from "../../generated/prisma/client";

// Quién recibe cada evento.
export const EVENT_RECIPIENTS: Record<RepairEventType, Role[]> = {
  lead_created: ["customer"],
  lead_reinforcement: ["customer"],
  lead_reinforcement_2: ["customer"],
  lead_reinforcement_3: ["customer"],
  lead_won: ["customer"],
  lead_lost: ["customer"],
  budget_created: ["customer", "inspector", "insurance"],
  turn_assigned: ["customer", "inspector", "insurance"],
  parts_pending: ["customer"],
  vehicle_entered: ["customer", "insurance"],
  paint_started: ["customer"],
  polish_started: ["customer"],
  quality_check: ["customer", "inspector", "insurance"],
  delivery_appointment: ["customer"],
  customer_experience: ["customer"],
};

type Settings = Awaited<ReturnType<typeof getAppSettings>>;

// Toggle de Configuración → Notificaciones que habilita cada evento. Sin
// entrada = sale siempre (los refuerzos 2 y 3 son envíos manuales).
const SETTINGS_FLAG: Partial<Record<RepairEventType, keyof Settings>> = {
  lead_created: "notifyOnLeadCreated",
  lead_reinforcement: "notifyOnBudgetReminder",
  lead_won: "notifyOnStageChange",
  lead_lost: "notifyOnStageChange",
  budget_created: "notifyBudgetCreated",
  turn_assigned: "notifyTurnAssigned",
  parts_pending: "notifyPartsReceived",
  vehicle_entered: "notifyVehicleEntered",
  paint_started: "notifyOnStageChange",
  polish_started: "notifyOnStageChange",
  quality_check: "notifyRepairCompleted",
  delivery_appointment: "notifyOnStageChange",
  customer_experience: "notifyCustomerExperience",
};

type Actor = {
  role: Role;
  name: string | null;
  email: string;
};

type RepairContext = {
  /** Para el registro del envío. */
  leadId?: string;
  repairId?: string;
  customerName: string;
  customerEmail: string;
  /** Teléfono tal como se cargó; el WhatsApp va al celular argentino que resulte. */
  customerPhone: string | null;
  vehicleSummary: string;
  inspector: { name: string | null; email: string | null } | null;
  insuranceAgent: { name: string | null; email: string | null } | null;
  budgetNumber?: number;
  budgetTotal?: string;
  surveyUrl?: string;
  turnAt?: DayTime;
  deliveryAt?: DayTime;
};

type SendResult = {
  event: RepairEventType;
  enabled: boolean;
  sent: Array<{
    channel: "email" | "whatsapp";
    role: Actor["role"];
    recipient: string;
    ok: boolean;
    error?: string;
  }>;
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

// El server corre en UTC: sin timeZone la hora del turno sale corrida.
const AR_TZ = "America/Argentina/Buenos_Aires";
const DAY_FMT = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: AR_TZ,
});
const TIME_FMT = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: AR_TZ,
});

/** "jueves 26 de noviembre" + "14:30", en hora argentina. */
export function arDayTime(d: Date): DayTime {
  return { day: DAY_FMT.format(d).replace(",", ""), time: TIME_FMT.format(d) };
}

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

async function logAttempt(
  event: NotifyEvent,
  ctx: RepairContext,
  row: {
    channel?: "email" | "whatsapp";
    recipient: string;
    role: Role;
    ok: boolean;
    error?: string;
    whatsappMessageId?: string;
  },
) {
  await prisma.notificationLog
    .create({
      data: {
        event,
        leadId: ctx.leadId ?? null,
        repairId: ctx.repairId ?? null,
        ...row,
      },
    })
    .catch((e) =>
      console.error("[notifications] no se pudo registrar el envío:", e),
    );
}

/**
 * Envía el mail del evento a los destinatarios correspondientes.
 * No tira excepciones — captura y registra errores por destinatario.
 */
export async function sendRepairEventNotification(
  event: RepairEventType,
  ctx: RepairContext,
): Promise<SendResult> {
  const settings = await getAppSettings();
  const flag = SETTINGS_FLAG[event];
  if (flag && !settings[flag]) {
    return { event, enabled: false, sent: [] };
  }

  const actors = resolveActors(event, ctx);
  if (actors.length === 0) {
    await logAttempt(event, ctx, {
      recipient: "",
      role: "customer",
      ok: false,
      error: "Sin destinatario con mail",
    });
  }
  const taller = {
    name: settings.companyName,
    phone: settings.companyPhone ?? "",
    email: settings.companyEmail ?? "",
  };

  const sent: SendResult["sent"] = [];

  for (const actor of actors) {
    try {
      await sendEmail({
        to: actor.email,
        subject: eventSubject(event, actor.role),
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
            turnAt={ctx.turnAt}
            deliveryAt={ctx.deliveryAt}
            taller={taller}
          />
        ),
      });
      sent.push({
        channel: "email",
        role: actor.role,
        recipient: actor.email,
        ok: true,
      });
      await logAttempt(event, ctx, {
        recipient: actor.email,
        role: actor.role,
        ok: true,
      });
    } catch (e) {
      console.error(
        `[notifications] Falló envío ${event} → ${actor.email}:`,
        e,
      );
      const error = e instanceof Error ? e.message : "Error desconocido";
      sent.push({
        channel: "email",
        role: actor.role,
        recipient: actor.email,
        ok: false,
        error,
      });
      await logAttempt(event, ctx, {
        recipient: actor.email,
        role: actor.role,
        ok: false,
        error,
      });
    }
  }

  if (EVENT_RECIPIENTS[event].includes("customer") && settings.whatsappEnabled) {
    sent.push(await sendCustomerWhatsapp(event, ctx));
  }

  return { event, enabled: true, sent };
}

// ─────────────────────────────────────────────────────────────
// WhatsApp al cliente
// ─────────────────────────────────────────────────────────────

/**
 * Plantilla de Twilio de cada aviso (se crean en el Content Template Builder
 * con estos nombres). Variables: {{1}} nombre del cliente, {{2}} vehículo,
 * {{3}} día y {{4}} hora del turno (o del turno de entrega); cada plantilla
 * usa solo las que necesita. El presupuesto nunca va por WhatsApp: C2 avisa
 * que salió por mail.
 */
const WA_TEMPLATE: Partial<Record<NotifyEvent, string>> = {
  lead_created: "taller_solicitud_recibida",
  lead_reinforcement: "taller_refuerzo1",
  lead_reinforcement_2: "taller_refuerzo2",
  lead_reinforcement_3: "taller_refuerzo3",
  lead_won: "taller_ganado",
  lead_lost: "taller_perdido",
  budget_sent: "taller_presupuesto_enviado",
  turn_assigned: "taller_turno_asignado",
  parts_pending: "taller_esperando_repuestos",
  vehicle_entered: "taller_ingreso",
  paint_started: "taller_pintura",
  polish_started: "taller_pulido_armado",
  quality_check: "taller_calidad",
  delivery_appointment: "taller_turno_entrega",
  customer_experience: "taller_experiencia",
};

/** Manda el WhatsApp del aviso al cliente y lo registra. No tira excepciones. */
async function sendCustomerWhatsapp(
  event: NotifyEvent,
  ctx: RepairContext,
): Promise<SendResult["sent"][number]> {
  const waId = waIdArgentina(ctx.customerPhone);
  const result = async (ok: boolean, error?: string, messageId?: string) => {
    await logAttempt(event, ctx, {
      channel: "whatsapp",
      recipient: waId ?? ctx.customerPhone ?? "",
      role: "customer",
      ok,
      error,
      whatsappMessageId: messageId,
    });
    return {
      channel: "whatsapp" as const,
      role: "customer" as const,
      recipient: waId ?? "",
      ok,
      error,
    };
  };

  const templateName = WA_TEMPLATE[event];
  if (!templateName) return result(false, "Este aviso no tiene WhatsApp");
  if (!waId) {
    return result(
      false,
      ctx.customerPhone
        ? `"${ctx.customerPhone}" no es un celular argentino válido`
        : "El cliente no tiene teléfono cargado",
    );
  }
  try {
    const contact = await upsertContact(waId, ctx.customerName);
    if (contact.optOutAt) {
      return result(false, "El cliente pidió la baja de WhatsApp");
    }
    const when =
      event === "delivery_appointment" ? ctx.deliveryAt : ctx.turnAt;
    const template = await templateByName(templateName, {
      "1": ctx.customerName,
      "2": ctx.vehicleSummary || "tu vehículo",
      "3": when?.day ?? "",
      "4": when?.time ?? "",
    });
    const message = await sendWhatsapp({
      contactId: contact.id,
      waId,
      template,
    });
    return result(true, undefined, message.id);
  } catch (e) {
    console.error(`[notifications] WhatsApp ${event} falló:`, e);
    return result(false, e instanceof Error ? e.message : "Error desconocido");
  }
}

/**
 * C2 · Al enviar el presupuesto por mail, el WhatsApp avisa que está en el
 * correo (el presupuesto no va por WhatsApp).
 */
export function notifyBudgetSentWhatsapp(budgetId: string) {
  after(async () => {
    try {
      const settings = await getAppSettings();
      if (!settings.whatsappEnabled) return;
      const ctx = await buildBudgetContext(budgetId);
      if (ctx) await sendCustomerWhatsapp("budget_sent", ctx);
    } catch (e) {
      console.error("[notif:budget_sent] error en envío:", e);
    }
  });
}

/**
 * Línea de tiempo de avisos (mails y WhatsApp, con su estado de entrega) de
 * una oportunidad y de su reparación: la ficha de cada una muestra la historia
 * completa del cliente.
 */
export function notificationTimeline(leadId: string | null, repairId?: string) {
  return prisma.notificationLog.findMany({
    where: {
      OR: [
        ...(leadId ? [{ leadId }, { repair: { leadId } }] : []),
        ...(repairId ? [{ repairId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      whatsappMessage: { select: { status: true, errorCode: true } },
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Disparo después de responder
// ─────────────────────────────────────────────────────────────

/**
 * Manda el aviso de una tarjeta de Producción sin demorar la respuesta.
 * `after` mantiene viva la función en Vercel hasta que termina el envío; el
 * fire-and-forget anterior quedaba congelado al responder y los mails
 * llegaban tarde o nunca (bug B1).
 */
export function notifyRepairEvent(event: RepairEventType, repairId: string) {
  after(async () => {
    try {
      const ctx = await buildRepairContext(repairId);
      if (ctx) await sendRepairEventNotification(event, ctx);
    } catch (e) {
      console.error(`[notif:${event}] error en envío:`, e);
    }
  });
}

/** Igual que notifyRepairEvent, para avisos de la oportunidad (CRM). */
export function notifyLeadEvent(event: RepairEventType, leadId: string) {
  after(async () => {
    try {
      const ctx = await buildLeadContext(leadId);
      if (ctx) await sendRepairEventNotification(event, ctx);
    } catch (e) {
      console.error(`[notif:${event}] error en envío:`, e);
    }
  });
}

const LEAD_STATUS_EVENT: Partial<Record<LeadStatus, RepairEventType>> = {
  refuerzo: "lead_reinforcement",
  ganado: "lead_won",
  perdido: "lead_lost",
};

/** Aviso al cliente cuando la oportunidad cambia de columna (C3, C5, C6). */
export function notifyLeadStatusChange(
  leadId: string,
  from: LeadStatus,
  to: LeadStatus,
) {
  const event = LEAD_STATUS_EVENT[to];
  if (event && from !== to) notifyLeadEvent(event, leadId);
}

// ─────────────────────────────────────────────────────────────
// Helpers para construir el RepairContext desde la DB
// ─────────────────────────────────────────────────────────────

/**
 * Carga el contexto desde un Repair (usado por los triggers de status).
 * Si el Repair tiene leadId, intenta resolver inspector/productor desde
 * el lead; si no, devuelve null en esos campos (cliente único destinatario).
 */
export async function buildRepairContext(
  repairId: string,
): Promise<RepairContext | null> {
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

  return {
    repairId: repair.id,
    customerName: repair.customerName,
    customerEmail: repair.customerEmail,
    customerPhone: repair.customerPhone,
    vehicleSummary: `${repair.vehicleBrand} ${repair.vehicleModel} ${repair.vehicleYear} · ${repair.vehicleDomain}`,
    inspector: repair.lead?.inspector ?? null,
    insuranceAgent: repair.lead?.insuranceAgent ?? null,
    budgetNumber: repair.budget?.number,
    budgetTotal: repair.budget
      ? ARS.format(Number(repair.budget.grandTotal))
      : undefined,
    surveyUrl,
    turnAt: repair.scheduledAt ? arDayTime(repair.scheduledAt) : undefined,
    deliveryAt: repair.deliveryAppointmentAt
      ? arDayTime(repair.deliveryAppointmentAt)
      : undefined,
  };
}

/**
 * Construye el contexto desde un Lead (avisos del CRM, antes de que exista
 * el Repair). Las oportunidades del formulario web todavía no tienen
 * vehículo: el copy usa "tu vehículo" sin detalle.
 */
export async function buildLeadContext(
  leadId: string,
): Promise<RepairContext | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      vehicle: {
        select: { brand: true, model: true, year: true, domain: true },
      },
      inspector: { select: { name: true, email: true } },
      insuranceAgent: { select: { name: true, email: true } },
    },
  });
  if (!lead) return null;

  return {
    leadId: lead.id,
    customerName: lead.customer.name,
    customerEmail: lead.customer.email,
    customerPhone: lead.customer.phone,
    vehicleSummary: lead.vehicle
      ? `${lead.vehicle.brand} ${lead.vehicle.model} ${lead.vehicle.year} · ${lead.vehicle.domain}`
      : "",
    inspector: lead.inspector ?? null,
    insuranceAgent: lead.insuranceAgent ?? null,
  };
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
    leadId: budget.leadId,
    customerName: budget.customerName,
    customerEmail: budget.customerEmail,
    customerPhone: budget.customerPhone,
    vehicleSummary: `${budget.vehicleBrand} ${budget.vehicleModel} ${budget.vehicleYear} · ${budget.vehicleDomain}`,
    inspector: budget.lead.inspector ?? null,
    insuranceAgent: budget.lead.insuranceAgent ?? null,
    budgetNumber: budget.number,
    budgetTotal: ARS.format(Number(budget.grandTotal)),
  };
  return ctx;
}
