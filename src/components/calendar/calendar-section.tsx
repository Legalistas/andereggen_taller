"use client";

import {
  ArrowRightLeft,
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  Loader2,
  LogIn,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import EventDetailDialog from "./event-detail-dialog";
import PendingTurnosPanel from "./pending-turnos-panel";

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

// spec 2.3 v2 · El taller no toma turnos los domingos. Renderizamos 6
// columnas (Lun–Sáb) y omitimos el domingo tanto del header como de la
// grilla. Los turnos legacy que hayan quedado con fecha de domingo (por el
// bug de TZ) igual no aparecen en la vista pero siguen accesibles desde el
// listado de "Próximos eventos" para que el equipo los reprograme.
const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const VISIBLE_WEEKDAYS = 6;
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

type ViewMode = "mes" | "semana";

/** Lunes de la semana que contiene la fecha dada. */
function mondayOf(d: Date): Date {
  const weekday = (d.getDay() + 6) % 7; // 0=Lun ... 6=Dom
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - weekday);
  return monday;
}

export default function CalendarSection() {
  const now = new Date();
  // Vista mes: navega por año/mes. Vista semana: el "anchor" define la
  // semana visible (siempre 6 días Lun-Sáb desde el lunes que contiene el
  // anchor). Ambas comparten el mismo endpoint (fetch por mes).
  const [viewMode, setViewMode] = useState<ViewMode>("mes");
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [weekAnchor, setWeekAnchor] = useState<Date>(now);
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  // spec 2.3 v2 · Modal de detalle. Click en el chip de un evento abre este
  // dialog para ver/editar hora del turno y toggle de traslado.
  const [openEvent, setOpenEvent] = useState<DayEvent | null>(null);
  // Modal de "turnos pendientes por asignar". Se abre por botón (sin fecha
  // prefill) o por click en una celda del calendario (con fecha prefill).
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingPrefill, setPendingPrefill] = useState<string | undefined>();
  // Contador de pendientes visible en el botón. Lo levantamos con un fetch
  // liviano al mismo endpoint que usa el panel adentro del modal.
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  // En vista semana el anchor manda: la fetch usa el mes del anchor para que
  // los eventos de la semana lleguen aun si cruza fin de mes (la API ya trae
  // ±7 días de padding). En vista mes usamos year/month0.
  const monthParam =
    viewMode === "semana"
      ? `${weekAnchor.getFullYear()}-${String(weekAnchor.getMonth() + 1).padStart(2, "0")}`
      : `${year}-${String(month0 + 1).padStart(2, "0")}`;

  const fetchCalendar = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/calendar?month=${monthParam}`, {
          signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = (await res.json()) as CalendarPayload;
        setData(d);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Error");
        }
      } finally {
        setLoading(false);
      }
    },
    [monthParam],
  );

  useEffect(() => {
    const ac = new AbortController();
    fetchCalendar(ac.signal);
    return () => ac.abort();
  }, [fetchCalendar]);

  // Contador de turnos pendientes (badge en el botón). Se refresca cuando
  // se cierra el modal (por si asignaron alguno).
  const fetchPendingCount = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/calendar/pending", { signal });
      if (!res.ok) return;
      const d = (await res.json()) as { rows: unknown[] };
      setPendingCount(d.rows.length);
    } catch {
      /* silencioso — el badge es opcional */
    }
  }, []);
  useEffect(() => {
    const ac = new AbortController();
    fetchPendingCount(ac.signal);
    return () => ac.abort();
  }, [fetchPendingCount]);

  /** Arma un `YYYY-MM-DDT09:00` local para prefill del dialog al clickear
   *  una celda. 9 AM es un horario razonable de apertura del taller. */
  const dayCellToPrefill = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}T09:00`;
  };

  const openPendingForDay = (d: Date) => {
    setPendingPrefill(dayCellToPrefill(d));
    setPendingOpen(true);
  };
  const openPendingFromButton = () => {
    setPendingPrefill(undefined);
    setPendingOpen(true);
  };
  const closePendingModal = () => {
    setPendingOpen(false);
    setPendingPrefill(undefined);
    fetchPendingCount();
  };

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

  const grid = useMemo(() => {
    // Filtramos los domingos (getDay()===0) para dejar 6 columnas de lun a
    // sáb. La grilla base sigue construyéndose con offset lunes-first.
    if (viewMode === "semana") {
      // Semana: 6 celdas Lun-Sáb desde el lunes que contiene el anchor.
      const monday = mondayOf(weekAnchor);
      const cells = [] as Array<{ date: Date; inMonth: boolean; key: string }>;
      for (let i = 0; i < VISIBLE_WEEKDAYS; i++) {
        const d = new Date(
          monday.getFullYear(),
          monday.getMonth(),
          monday.getDate() + i,
        );
        cells.push({
          date: d,
          // En vista semana no hay "fuera de mes" — siempre destacamos igual.
          inMonth: true,
          key: toKey(d.getFullYear(), d.getMonth(), d.getDate()),
        });
      }
      return cells;
    }
    const all = buildMonthGrid(year, month0);
    return all.filter((cell) => cell.date.getDay() !== 0);
  }, [viewMode, weekAnchor, year, month0]);
  const today = todayKey();

  // Header con el rango visible según modo.
  const rangeLabel = useMemo(() => {
    if (viewMode === "semana" && grid.length > 0) {
      const first = grid[0].date;
      const last = grid[grid.length - 1].date;
      const sameMonth = first.getMonth() === last.getMonth();
      const firstStr = `${first.getDate()} ${MONTH_LABELS[first.getMonth()].slice(0, 3)}`;
      const lastStr = sameMonth
        ? `${last.getDate()} ${MONTH_LABELS[last.getMonth()].slice(0, 3)}`
        : `${last.getDate()} ${MONTH_LABELS[last.getMonth()].slice(0, 3)}`;
      return `${firstStr} – ${lastStr} ${last.getFullYear()}`;
    }
    return `${MONTH_LABELS[month0]} ${year}`;
  }, [viewMode, grid, month0, year]);

  const prev = () => {
    if (viewMode === "semana") {
      const d = new Date(weekAnchor);
      d.setDate(d.getDate() - 7);
      setWeekAnchor(d);
      return;
    }
    if (month0 === 0) {
      setYear((y) => y - 1);
      setMonth0(11);
    } else {
      setMonth0((m) => m - 1);
    }
  };
  const next = () => {
    if (viewMode === "semana") {
      const d = new Date(weekAnchor);
      d.setDate(d.getDate() + 7);
      setWeekAnchor(d);
      return;
    }
    if (month0 === 11) {
      setYear((y) => y + 1);
      setMonth0(0);
    } else {
      setMonth0((m) => m + 1);
    }
  };
  const goToday = () => {
    if (viewMode === "semana") {
      setWeekAnchor(new Date());
      return;
    }
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
            <Button variant="ghost" size="icon" onClick={prev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-55 text-center">
              <div className="text-lg font-semibold text-slate-900">
                {rangeLabel}
              </div>
              {loading && (
                <div className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={next}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              Hoy
            </Button>
            {/* spec 2.3 v2 · Botón para abrir turnos pendientes en modal.
                Reemplaza al panel que antes estaba fijo arriba del calendario. */}
            <Button
              variant="outline"
              size="sm"
              onClick={openPendingFromButton}
              className="ml-2 gap-1.5"
            >
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              Turnos pendientes
              {pendingCount !== null && pendingCount > 0 && (
                <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </Button>
            {/* Toggle Mes / Semana */}
            <div className="ml-1 inline-flex rounded-md border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("mes")}
                className={`inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium transition ${
                  viewMode === "mes"
                    ? "bg-[#003b73] text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
                aria-pressed={viewMode === "mes"}
              >
                <LayoutGrid className="h-3 w-3" />
                Mes
              </button>
              <button
                type="button"
                onClick={() => {
                  // Al pasar a semana, anclamos al lunes de la semana que
                  // contiene el mes visible (o hoy si estamos en el mes actual).
                  const isCurrent =
                    year === now.getFullYear() && month0 === now.getMonth();
                  setWeekAnchor(
                    isCurrent ? new Date() : new Date(year, month0, 1),
                  );
                  setViewMode("semana");
                }}
                className={`inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium border-l border-slate-200 transition ${
                  viewMode === "semana"
                    ? "bg-[#003b73] text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
                aria-pressed={viewMode === "semana"}
              >
                <CalendarDays className="h-3 w-3" />
                Semana
              </button>
            </div>
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
        <div className="grid grid-cols-6 border-b border-slate-200 bg-slate-50">
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
        <div className="grid grid-cols-6 divide-x divide-y divide-slate-100">
          {grid.map((cell) => {
            const events = eventsByDay.get(cell.key) ?? [];
            const isToday = cell.key === today;
            // En vista Semana mostramos TODOS los eventos con scroll interno;
            // en Mes limitamos y agrupamos el resto detrás de "+N más".
            const isWeek = viewMode === "semana";
            const visible = isWeek
              ? events
              : events.slice(0, MAX_VISIBLE_EVENTS);
            const hiddenCount = isWeek ? 0 : events.length - visible.length;
            return (
              <div
                key={cell.key}
                className={`${isWeek ? "h-96" : "h-32"} overflow-hidden p-1.5 flex flex-col gap-1 ${
                  cell.inMonth ? "bg-white" : "bg-slate-50/50"
                }`}
              >
                <div
                  className={`flex items-center justify-between text-[11px] shrink-0 ${
                    cell.inMonth ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openPendingForDay(cell.date)}
                    title="Asignar un turno pendiente en este día"
                    className={
                      isToday
                        ? "inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#003b73] text-white font-semibold hover:opacity-90"
                        : "font-medium hover:text-[#003b73] hover:underline"
                    }
                  >
                    {cell.date.getDate()}
                  </button>
                  {isWeek && events.length > 0 && (
                    <span className="text-[10px] text-slate-500">
                      {events.length}{" "}
                      {events.length === 1 ? "evento" : "eventos"}
                    </span>
                  )}
                </div>
                <div
                  className={`flex flex-col gap-1 min-h-0 ${isWeek ? "overflow-y-auto" : ""}`}
                >
                  {visible.map((ev) => (
                    <EventChip
                      key={`${ev.repairId}-${ev.kind}`}
                      event={ev}
                      saving={savingId === ev.repairId}
                      onToggleTransport={(next) =>
                        toggleTransport(ev.repairId, next)
                      }
                      onOpen={setOpenEvent}
                    />
                  ))}
                  {hiddenCount > 0 && (
                    <DayOverflow
                      dateLabel={formatDayLabel(cell.date)}
                      events={events}
                      savingId={savingId}
                      onToggleTransport={toggleTransport}
                      onOpen={setOpenEvent}
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

      {openEvent && (
        <EventDetailDialog
          event={openEvent}
          onClose={() => setOpenEvent(null)}
          onSaved={() => {
            setOpenEvent(null);
            fetchCalendar();
          }}
        />
      )}

      {/* spec 2.3 v2 · Modal de turnos pendientes. Se abre por el botón del
          header (sin fecha prefill) o por click en una celda (con prefill). */}
      <Dialog open={pendingOpen} onOpenChange={(v) => !v && closePendingModal()}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b bg-slate-50 flex flex-row items-center justify-between gap-2">
            <DialogTitle className="text-sm font-semibold text-slate-700 inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              Asignar turno pendiente
              {pendingPrefill && (
                <span className="text-xs font-normal text-slate-500">
                  · prefill al día seleccionado
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            <PendingTurnosPanel
              bare
              defaultDate={pendingPrefill}
              onAssigned={() => {
                fetchCalendar();
                fetchPendingCount();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventChip({
  event,
  saving,
  onToggleTransport,
  onOpen,
}: {
  event: DayEvent;
  saving: boolean;
  onToggleTransport: (next: boolean) => void;
  onOpen: (event: DayEvent) => void;
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
        <button
          type="button"
          onClick={() => onOpen(event)}
          className="truncate text-left hover:underline"
          title={`${event.customerName} · ${event.vehicleSummary} · ${event.vehicleDomain}`}
        >
          {event.customerName}
        </button>
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
  onOpen,
}: {
  dateLabel: string;
  events: DayEvent[];
  savingId: string | null;
  onToggleTransport: (repairId: string, next: boolean) => void;
  onOpen: (event: DayEvent) => void;
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
              onOpen={onOpen}
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
