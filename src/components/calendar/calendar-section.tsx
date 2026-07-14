"use client";

import {
  ArrowRightLeft,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogIn,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * spec 2.3 v2 · Módulo de Calendario.
 * Reemplaza el Excel actual de gestión de turnos. Vista mensual con dos
 * tipos de evento por card:
 *   - Ingreso (turno coordinado — Repair.scheduledAt)
 *   - Entrega estimada (Repair.estimatedDeliveryAt)
 * Checkbox de "traslado" editable inline: la persona pide que la lleven al
 * dejar el vehículo. Es sobre la persona, no el auto.
 */

type CalendarEvent = {
  repairId: string;
  internalNumber: number | null;
  customerName: string;
  vehicleSummary: string;
  vehicleDomain: string;
  date: string;
  needsTransport: boolean;
  status: string;
};

type CalendarPayload = {
  month: string;
  turnos: CalendarEvent[];
  entregas: CalendarEvent[];
};

type EventKind = "ingreso" | "entrega";
type DayEvent = CalendarEvent & { kind: EventKind };

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function toKey(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function keyFromISO(iso: string): string {
  const d = new Date(iso);
  return toKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function todayKey(): string {
  const now = new Date();
  return toKey(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Devuelve las 42 celdas (6 semanas × 7 días) que forman la grilla del mes.
 * Arranca el lunes previo o igual al 1 del mes y termina el domingo posterior
 * o igual al último. Cada celda trae `date` y flag `inMonth`.
 */
function buildMonthGrid(year: number, month0: number) {
  const first = new Date(year, month0, 1);
  // JS: 0=Dom, 1=Lun ... — convertimos a 0=Lun ... 6=Dom
  const firstWeekday = (first.getDay() + 6) % 7;
  const start = new Date(year, month0, 1 - firstWeekday);

  const cells: Array<{ date: Date; inMonth: boolean; key: string }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: d,
      inMonth: d.getMonth() === month0,
      key: toKey(d.getFullYear(), d.getMonth(), d.getDate()),
    });
  }
  return cells;
}

const TIME_FMT = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

const DAY_FMT = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function formatDayLabel(d: Date): string {
  return DAY_FMT.format(d);
}

// Máximo de eventos que caben en una celda del mes (altura fija h-32).
// El resto se agrupa detrás de un botón "+N más" tipo Google Calendar.
const MAX_VISIBLE_EVENTS = 2;

export default function CalendarSection() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const monthParam = `${year}-${String(month0 + 1).padStart(2, "0")}`;

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/calendar?month=${monthParam}`, { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as CalendarPayload;
      })
      .then((d) => setData(d))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Error");
        }
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [monthParam]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    if (!data) return map;
    for (const e of data.turnos) {
      const k = keyFromISO(e.date);
      const list = map.get(k) ?? [];
      list.push({ ...e, kind: "ingreso" });
      map.set(k, list);
    }
    for (const e of data.entregas) {
      const k = keyFromISO(e.date);
      const list = map.get(k) ?? [];
      list.push({ ...e, kind: "entrega" });
      map.set(k, list);
    }
    // Orden cronológico dentro del día
    for (const list of map.values()) {
      list.sort((a, b) => a.date.localeCompare(b.date));
    }
    return map;
  }, [data]);

  const grid = useMemo(() => buildMonthGrid(year, month0), [year, month0]);
  const today = todayKey();

  const prevMonth = () => {
    if (month0 === 0) {
      setYear((y) => y - 1);
      setMonth0(11);
    } else {
      setMonth0((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (month0 === 11) {
      setYear((y) => y + 1);
      setMonth0(0);
    } else {
      setMonth0((m) => m + 1);
    }
  };
  const goToday = () => {
    setYear(now.getFullYear());
    setMonth0(now.getMonth());
  };

  const toggleTransport = async (repairId: string, next: boolean) => {
    setSavingId(repairId);
    try {
      const res = await fetch(`/api/repairs/${repairId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ needsTransport: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Actualizamos localmente sin refetch para no perder scroll ni parpadear.
      setData((prev) => {
        if (!prev) return prev;
        const patch = (arr: CalendarEvent[]) =>
          arr.map((e) =>
            e.repairId === repairId ? { ...e, needsTransport: next } : e,
          );
        return {
          ...prev,
          turnos: patch(prev.turnos),
          entregas: patch(prev.entregas),
        };
      });
    } catch (e) {
      alert(
        e instanceof Error
          ? `No se pudo guardar: ${e.message}`
          : "No se pudo guardar el traslado",
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-55 text-center">
              <div className="text-lg font-semibold text-slate-900">
                {MONTH_LABELS[month0]} {year}
              </div>
              {loading && (
                <div className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              Hoy
            </Button>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
              Ingreso
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              Entrega estimada
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowRightLeft className="h-3 w-3 text-amber-600" />
              Traslado solicitado
            </span>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-3 border-rose-200 bg-rose-50 text-sm text-rose-700">
          No se pudo cargar el calendario: {error}
        </Card>
      )}

      <Card className="overflow-hidden">
        {/* Header semana */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAY_LABELS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-600"
            >
              {d}
            </div>
          ))}
        </div>
        {/* Grid celdas — altura fija tipo Google Calendar. Máx 3 eventos
             visibles y el resto detrás de un "+N más". */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {grid.map((cell) => {
            const events = eventsByDay.get(cell.key) ?? [];
            const isToday = cell.key === today;
            const visible = events.slice(0, MAX_VISIBLE_EVENTS);
            const hiddenCount = events.length - visible.length;
            return (
              <div
                key={cell.key}
                className={`h-32 overflow-hidden p-1.5 flex flex-col gap-1 ${
                  cell.inMonth ? "bg-white" : "bg-slate-50/50"
                }`}
              >
                <div
                  className={`flex items-center justify-between text-[11px] shrink-0 ${
                    cell.inMonth ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  <span
                    className={
                      isToday
                        ? "inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#003b73] text-white font-semibold"
                        : "font-medium"
                    }
                  >
                    {cell.date.getDate()}
                  </span>
                </div>
                <div className="flex flex-col gap-1 min-h-0">
                  {visible.map((ev) => (
                    <EventChip
                      key={`${ev.repairId}-${ev.kind}`}
                      event={ev}
                      saving={savingId === ev.repairId}
                      onToggleTransport={(next) =>
                        toggleTransport(ev.repairId, next)
                      }
                    />
                  ))}
                  {hiddenCount > 0 && (
                    <DayOverflow
                      dateLabel={formatDayLabel(cell.date)}
                      events={events}
                      savingId={savingId}
                      onToggleTransport={toggleTransport}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Lista compacta debajo — útil en mobile / para escanear rápido */}
      <UpcomingList data={data} />
    </div>
  );
}

function EventChip({
  event,
  saving,
  onToggleTransport,
}: {
  event: DayEvent;
  saving: boolean;
  onToggleTransport: (next: boolean) => void;
}) {
  const bg =
    event.kind === "ingreso"
      ? "bg-blue-50 border-blue-200 text-blue-900"
      : "bg-emerald-50 border-emerald-200 text-emerald-900";
  const Icon = event.kind === "ingreso" ? LogIn : LogOut;
  const time = TIME_FMT.format(new Date(event.date));
  return (
    <div
      className={`group rounded border ${bg} px-1.5 py-0.5 text-[11px] leading-tight shrink-0`}
    >
      <div className="flex items-center gap-1">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="font-semibold tabular-nums">{time}</span>
        <Link
          href={`/produccion?repairId=${event.repairId}`}
          className="truncate hover:underline"
          title={`${event.customerName} · ${event.vehicleSummary} · ${event.vehicleDomain}`}
        >
          {event.customerName}
        </Link>
        <button
          type="button"
          disabled={saving}
          onClick={() => onToggleTransport(!event.needsTransport)}
          title={
            event.needsTransport
              ? "Traslado solicitado — click para desmarcar"
              : "Marcar traslado del cliente"
          }
          className={`ml-auto inline-flex items-center shrink-0 rounded p-0.5 disabled:opacity-50 ${
            event.needsTransport
              ? "bg-amber-100 text-amber-700"
              : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          }`}
        >
          <ArrowRightLeft className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/**
 * Botón "+N más" tipo Google Calendar. Abre un Popover con todos los
 * eventos del día — mismos chips que en la celda, con la fila del vehículo
 * completa y el toggle de traslado.
 */
function DayOverflow({
  dateLabel,
  events,
  savingId,
  onToggleTransport,
}: {
  dateLabel: string;
  events: DayEvent[];
  savingId: string | null;
  onToggleTransport: (repairId: string, next: boolean) => void;
}) {
  const hidden = events.length - MAX_VISIBLE_EVENTS;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-left text-[10px] font-medium text-[#003b73] hover:underline shrink-0"
        >
          + {hidden} más
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <div className="text-xs font-semibold text-slate-900 capitalize mb-2">
          {dateLabel}
        </div>
        <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto">
          {events.map((ev) => (
            <EventChip
              key={`overflow-${ev.repairId}-${ev.kind}`}
              event={ev}
              saving={savingId === ev.repairId}
              onToggleTransport={(next) => onToggleTransport(ev.repairId, next)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UpcomingList({ data }: { data: CalendarPayload | null }) {
  const now = Date.now();
  const items = useMemo(() => {
    if (!data) return [];
    const all: DayEvent[] = [
      ...data.turnos.map((e) => ({ ...e, kind: "ingreso" as const })),
      ...data.entregas.map((e) => ({ ...e, kind: "entrega" as const })),
    ];
    return all
      .filter((e) => new Date(e.date).getTime() >= now - 86400_000)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 12);
  }, [data, now]);

  if (items.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarIcon className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">
          Próximos eventos
        </h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((ev) => (
          <li
            key={`${ev.repairId}-${ev.kind}-${ev.date}`}
            className="py-2 flex items-center gap-3 text-sm"
          >
            <span
              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                ev.kind === "ingreso"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {ev.kind === "ingreso" ? "Ingreso" : "Entrega"}
            </span>
            <span className="tabular-nums text-slate-700 shrink-0">
              {new Intl.DateTimeFormat("es-AR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(ev.date))}
            </span>
            <Link
              href={`/produccion?repairId=${ev.repairId}`}
              className="font-medium text-slate-900 hover:underline truncate"
            >
              {ev.customerName}
            </Link>
            <span className="text-slate-500 truncate">
              {ev.vehicleSummary} · {ev.vehicleDomain}
            </span>
            {ev.needsTransport && (
              <span
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium"
                title="Traslado solicitado"
              >
                <ArrowRightLeft className="h-3 w-3" />
                Traslado
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
