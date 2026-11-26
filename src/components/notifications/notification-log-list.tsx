import { Mail, MessageCircle } from "lucide-react";
import type { NotifyEvent } from "@/lib/email/templates/repair-event";
import { FALTA_PLANTILLA, formatWaId } from "@/lib/whatsapp/parse";

/** Fila de NotificationLog tal como la devuelven los GET de lead y repair. */
export type NotificationLogRow = {
  id: string;
  event: string;
  channel: string;
  recipient: string;
  role: string;
  ok: boolean;
  error: string | null;
  createdAt: string;
  whatsappMessage: { status: string | null; errorCode: string | null } | null;
};

const EVENT_LABELS: Record<NotifyEvent, string> = {
  lead_created: "Solicitud recibida",
  lead_reinforcement: "Refuerzo 1",
  lead_reinforcement_2: "Refuerzo 2",
  lead_reinforcement_3: "Refuerzo 3",
  lead_won: "Agradecimiento (ganada)",
  lead_lost: "Oportunidad perdida",
  budget_created: "Presupuesto generado",
  budget_sent: "Presupuesto enviado",
  turn_assigned: "Turno asignado",
  turn_reminder: "Recordatorio de turno",
  parts_pending: "Pendiente de repuestos",
  vehicle_entered: "Ingreso al taller",
  paint_started: "Pasó a pintura",
  polish_started: "Pasó a pulido / armado",
  quality_check: "Entró a calidad",
  delivery_appointment: "Turno de entrega",
  customer_experience: "Encuesta de experiencia",
};

const ROLE_LABELS: Record<string, string> = {
  inspector: "perito",
  insurance: "productor",
  other: "otro",
};

/** Estado de entrega de Twilio → lo que ve el equipo. */
const WA_STATUS: Record<string, { label: string; bad?: boolean }> = {
  accepted: { label: "en cola" },
  scheduled: { label: "en cola" },
  queued: { label: "en cola" },
  sending: { label: "enviando" },
  sent: { label: "enviado" },
  delivered: { label: "entregado" },
  read: { label: "leído" },
  undelivered: { label: "no entregado", bad: true },
  failed: { label: "no entregado", bad: true },
};

const WHEN = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Argentina/Buenos_Aires",
});

/**
 * Línea de tiempo de avisos al cliente (y a perito / productor): mails y
 * WhatsApp juntos, el más reciente arriba. Los WhatsApp muestran si llegaron
 * y si los leyeron.
 */
export function NotificationLogList({ logs }: { logs: NotificationLogRow[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Todavía no se envió ningún aviso.
      </p>
    );
  }
  return (
    <ol className="relative grid gap-3 border-l border-slate-200 ml-2">
      {logs.map((l) => {
        const wa = l.channel === "whatsapp";
        const label = EVENT_LABELS[l.event as NotifyEvent] ?? l.event;
        const delivery = l.whatsappMessage?.status
          ? WA_STATUS[l.whatsappMessage.status]
          : undefined;
        // Sin plantilla aprobada todavía: no es una falla, sale solo el mail.
        const pending = !l.ok && !!l.error?.startsWith(FALTA_PLANTILLA);
        const failed = (!l.ok && !pending) || delivery?.bad;
        const recipient =
          wa && /^\d+$/.test(l.recipient)
            ? formatWaId(l.recipient)
            : l.recipient;
        const to = [ROLE_LABELS[l.role], recipient].filter(Boolean).join(" · ");
        const Icon = wa ? MessageCircle : Mail;
        return (
          <li key={l.id} className="relative pl-5 text-xs">
            <span
              className={`absolute -left-[9px] top-0 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white ${
                failed
                  ? "bg-red-100 text-red-600"
                  : pending
                    ? "bg-slate-100 text-slate-400"
                    : wa
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-sky-100 text-sky-700"
              }`}
            >
              <Icon className="h-2.5 w-2.5" aria-hidden />
            </span>
            <p className="text-slate-700">
              <span className="tabular-nums text-slate-500">
                {WHEN.format(new Date(l.createdAt))}
              </span>{" "}
              — <span className="font-medium">{label}</span>
              <span className="text-slate-500">
                {" "}
                · {wa ? "WhatsApp" : "Mail"}{" "}
                {pending
                  ? "pendiente de plantilla"
                  : !l.ok
                    ? "no enviado"
                    : delivery
                      ? delivery.label
                      : "enviado"}
              </span>
            </p>
            {to && <p className="text-slate-500 break-all">{to}</p>}
            {!l.ok && l.error && (
              <p
                className={`break-words ${pending ? "text-slate-400" : "text-red-600"}`}
              >
                {l.error}
              </p>
            )}
            {l.ok && delivery?.bad && (
              <p className="text-red-600">
                Twilio no lo pudo entregar
                {l.whatsappMessage?.errorCode
                  ? ` (código ${l.whatsappMessage.errorCode})`
                  : ""}
                .
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
