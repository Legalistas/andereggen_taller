/**
 * Flota del taller — catálogos, fechas y validación de inputs.
 * Sin dependencias de servidor: lo usan las API routes y los componentes.
 *
 * Fechas: los campos de solo-día (vencimientos, service) se guardan a las
 * 00:00 UTC de ese día y se comparan como texto `YYYY-MM-DD`.
 */
import type {
  FleetMaintenanceKind,
  FleetObligationType,
} from "../../generated/prisma/client";

export const OBLIGATION_LABEL: Record<FleetObligationType, string> = {
  SEGURO: "Seguro",
  PATENTE: "Patente",
  VTV: "VTV",
  OTRO: "Otro",
};

export const MAINTENANCE_LABEL: Record<FleetMaintenanceKind, string> = {
  SERVICE: "Service",
  REPARACION: "Reparación",
  REPUESTO: "Repuesto",
};

export const PERIOD_OPTIONS = [
  { months: 1, label: "Mensual" },
  { months: 2, label: "Bimestral" },
  { months: 3, label: "Trimestral" },
  { months: 6, label: "Semestral" },
  { months: 12, label: "Anual" },
] as const;

/** Días de anticipación con los que un vencimiento pasa a "por vencer". */
export const ALERT_DAYS = 15;

/** Tope por archivo: Vercel corta los requests de más de 4,5 MB. Las fotos se achican en el navegador antes de subir. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

export function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ── Fechas ───────────────────────────────────────────────────

/** `YYYY-MM-DD` de un Date o de un ISO. */
export function day(d: Date | string): string {
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
}

/** Hoy en Argentina (UTC-3 fijo), como `YYYY-MM-DD`. */
export function arToday(now = new Date()): string {
  return day(new Date(now.getTime() - 3 * 3_600_000));
}

export function addDays(date: string, days: number): string {
  return day(new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000));
}

/** Suma meses sin desbordar: 31/01 + 1 mes = 28/02 (o 29). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return day(new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))));
}

export function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const [y, m, dd] = day(d).split("-");
  return `${dd}/${m}/${y}`;
}

export type DueStatus = "PAGADO" | "VENCIDO" | "POR_VENCER" | "PENDIENTE";

export function dueStatus(
  dueDate: Date | string,
  paidAt: Date | string | null,
  today: string,
): DueStatus {
  if (paidAt) return "PAGADO";
  const due = day(dueDate);
  if (due < today) return "VENCIDO";
  if (due <= addDays(today, ALERT_DAYS)) return "POR_VENCER";
  return "PENDIENTE";
}

// ── Alertas de vencimientos ──────────────────────────────────

export type FleetAlert = {
  vehicleId: string;
  plate: string;
  label: string;
  date: string;
  overdue: boolean;
};

type AlertVehicle = {
  id: string;
  plate: string;
  obligations: {
    type: FleetObligationType;
    provider: string | null;
    validUntil: Date | null;
    payments: { dueDate: Date; paidAt: Date | null }[];
  }[];
  maintenance: {
    kind: FleetMaintenanceKind;
    date: Date;
    nextDate: Date | null;
  }[];
};

/**
 * Cuotas impagas, vigencias (póliza, VTV) y próximo service que vencen
 * dentro de ALERT_DAYS o ya vencieron. Del service cuenta solo el último:
 * si ya se hizo uno nuevo, el aviso del anterior no aplica.
 */
export function fleetAlerts(
  vehicles: AlertVehicle[],
  today: string,
): FleetAlert[] {
  const limit = addDays(today, ALERT_DAYS);
  const alerts: FleetAlert[] = [];
  const push = (v: AlertVehicle, label: string, d: Date) => {
    const date = day(d);
    if (date <= limit)
      alerts.push({
        vehicleId: v.id,
        plate: v.plate,
        label,
        date,
        overdue: date < today,
      });
  };

  for (const v of vehicles) {
    for (const o of v.obligations) {
      const name = o.provider
        ? `${OBLIGATION_LABEL[o.type]} (${o.provider})`
        : OBLIGATION_LABEL[o.type];
      for (const p of o.payments) {
        if (!p.paidAt) push(v, `Pago de ${name}`, p.dueDate);
      }
      if (o.validUntil) push(v, `Vence ${name}`, o.validUntil);
    }
    const lastService = v.maintenance
      .filter((m) => m.kind === "SERVICE")
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
    if (lastService?.nextDate) push(v, "Próximo service", lastService.nextDate);
  }
  return alerts.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Validación de bodies (API) ───────────────────────────────
// Cada campo: undefined = no vino (un PATCH no lo toca), null = vaciarlo.

export class FleetInputError extends Error {}

type Body = Record<string, unknown>;

function text(b: Body, k: string): string | null | undefined {
  const v = b[k];
  if (v === undefined || v === null) return v;
  if (typeof v !== "string") throw new FleetInputError(`Campo ${k} inválido`);
  return v.trim() || null;
}

function int(b: Body, k: string): number | null | undefined {
  const v = b[k];
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0)
    throw new FleetInputError(`Campo ${k} inválido`);
  return n;
}

function money(b: Body, k: string): number | null | undefined {
  const v = b[k];
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0)
    throw new FleetInputError(`Monto ${k} inválido`);
  return n;
}

function date(b: Body, k: string): Date | null | undefined {
  const v = b[k];
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))
    throw new FleetInputError(`Fecha ${k} inválida`);
  return new Date(`${v}T00:00:00Z`);
}

function bool(b: Body, k: string): boolean | undefined {
  const v = b[k];
  if (v === undefined) return undefined;
  if (typeof v !== "boolean") throw new FleetInputError(`Campo ${k} inválido`);
  return v;
}

function oneOf<T extends string>(
  b: Body,
  k: string,
  values: readonly T[],
): T | undefined {
  const v = b[k];
  if (v === undefined) return undefined;
  if (!values.includes(v as T))
    throw new FleetInputError(`Campo ${k} inválido`);
  return v as T;
}

/** Obligatorio: no puede vaciarse, y al crear tiene que venir. */
function need<T>(
  v: T | null | undefined,
  create: boolean,
  msg: string,
): T | undefined {
  if (v === null || (create && v === undefined)) throw new FleetInputError(msg);
  return v;
}

export function parseVehicle(b: Body, create: boolean) {
  const plate = need(text(b, "plate"), create, "La patente es obligatoria");
  return {
    plate: plate === undefined ? undefined : normalizePlate(plate),
    brand: text(b, "brand"),
    model: text(b, "model"),
    year: int(b, "year"),
    color: text(b, "color"),
    chassisNumber: text(b, "chassisNumber"),
    engineNumber: text(b, "engineNumber"),
    ownerName: text(b, "ownerName"),
    transferred: bool(b, "transferred"),
    documentsLocation: text(b, "documentsLocation"),
    notes: text(b, "notes"),
    isActive: bool(b, "isActive"),
  };
}

export function parseObligation(b: Body, create: boolean) {
  return {
    type: need(
      oneOf(b, "type", Object.keys(OBLIGATION_LABEL) as FleetObligationType[]),
      create,
      "Elegí el tipo",
    ),
    provider: text(b, "provider"),
    reference: text(b, "reference"),
    holderName: text(b, "holderName"),
    autoDebit: bool(b, "autoDebit"),
    debitAccount: text(b, "debitAccount"),
    periodMonths: int(b, "periodMonths"),
    validUntil: date(b, "validUntil"),
    notes: text(b, "notes"),
  };
}

export function parsePayment(b: Body, create: boolean) {
  return {
    dueDate: need(
      date(b, "dueDate"),
      create,
      "La fecha de vencimiento es obligatoria",
    ),
    amount: money(b, "amount"),
    paidAt: date(b, "paidAt"),
    notes: text(b, "notes"),
  };
}

export function parseMaintenance(b: Body, create: boolean) {
  return {
    kind: need(
      oneOf(
        b,
        "kind",
        Object.keys(MAINTENANCE_LABEL) as FleetMaintenanceKind[],
      ),
      create,
      "Elegí el tipo",
    ),
    date: need(date(b, "date"), create, "La fecha es obligatoria"),
    mileage: int(b, "mileage"),
    description: need(
      text(b, "description"),
      create,
      "La descripción es obligatoria",
    ),
    provider: text(b, "provider"),
    cost: money(b, "cost"),
    nextDate: date(b, "nextDate"),
    nextMileage: int(b, "nextMileage"),
  };
}
