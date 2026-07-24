"use client";

import {
  ArrowRightLeft,
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  Phone,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * spec 2.3 v2 · Turnos pendientes por asignar. Lista los repairs con
 * status `turno_a_asignar` (oportunidades ganadas sin turno coordinado) y
 * permite asignar fecha/hora + traslado inline. Al guardar, la API dispara
 * la transición automática a `turno_asignado` y el mail al cliente.
 */

type PendingRow = {
  repairId: string;
  internalNumber: number | null;
  customerName: string;
  customerPhone: string;
  customerCity: string | null;
  vehicleSummary: string;
  vehicleDomain: string;
  insuranceCompany: string | null;
  estimatedDeliveryAt: string | null;
  needsTransport: boolean;
  waitingSince: string;
};

const DAY_MS = 86_400_000;

function waitingLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  return `Hace ${days} días`;
}

/** Fecha/hora local formateados para `<input type="datetime-local">`. */
function nowLocalDateTime(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function parseLocalDateTime(v: string): string {
  const [datePart, timePart] = v.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0).toISOString();
}

type Props = {
  /** Se dispara después de asignar un turno para que el calendario
   *  recargue los eventos del mes. */
  onAssigned?: () => void;
  /** Cuando el panel se usa desde un modal ya con su propio contenedor,
   *  desactivamos el Card exterior para no duplicar borde/fondo. */
  bare?: boolean;
  /** Fecha por defecto para el dialog de asignación. Si se pasa, prefill
   *  del datetime-local con este ISO local. Si no, usa "ahora". */
  defaultDate?: string;
};

export default function PendingTurnosPanel({
  onAssigned,
  bare = false,
  defaultDate,
}: Props) {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<PendingRow | null>(null);

  const fetchPending = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/pending", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { rows: PendingRow[] };
      setRows(data.rows);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Error");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetchPending(ac.signal);
    return () => ac.abort();
  }, [fetchPending]);

  const handleAssigned = () => {
    setOpenFor(null);
    fetchPending();
    onAssigned?.();
  };

  const Wrapper = bare
    ? ({ children }: { children: React.ReactNode }) => <>{children}</>
    : ({ children }: { children: React.ReactNode }) => <Card>{children}</Card>;

  return (
    <Wrapper>
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-700">
            Turnos pendientes por asignar
          </h3>
          {rows.length > 0 && (
            <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
              {rows.length}
            </span>
          )}
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {error && (
        <div className="p-3 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">
          {error}
        </div>
      )}

      {rows.length === 0 && !loading ? (
        <div className="p-6 text-center text-sm text-slate-500">
          No hay turnos pendientes. Cuando una oportunidad se gana sin fecha
          coordinada, aparece acá.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.repairId} className="px-4 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {r.internalNumber !== null && (
                    <span className="text-[10px] font-mono font-semibold text-slate-500 tabular-nums">
                      #{r.internalNumber}
                    </span>
                  )}
                  <span className="text-sm font-medium text-slate-900 truncate">
                    {r.customerName}
                  </span>
                  {r.needsTransport && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5"
                      title="Traslado solicitado"
                    >
                      <ArrowRightLeft className="h-2.5 w-2.5" />
                      Traslado
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {r.vehicleSummary} · {r.vehicleDomain}
                  {r.insuranceCompany && ` · ${r.insuranceCompany}`}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                  <span>{waitingLabel(r.waitingSince)}</span>
                  {r.customerPhone && (
                    <a
                      href={`tel:${r.customerPhone}`}
                      className="inline-flex items-center gap-1 hover:text-slate-700"
                    >
                      <Phone className="h-2.5 w-2.5" />
                      {r.customerPhone}
                    </a>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpenFor(r)}
                className="shrink-0"
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                Asignar turno
              </Button>
            </li>
          ))}
        </ul>
      )}

      {openFor && (
        <AssignTurnoDialog
          row={openFor}
          defaultDate={defaultDate}
          onClose={() => setOpenFor(null)}
          onSaved={handleAssigned}
        />
      )}
    </Wrapper>
  );
}

function AssignTurnoDialog({
  row,
  defaultDate,
  onClose,
  onSaved,
}: {
  row: PendingRow;
  /** ISO local (`YYYY-MM-DDTHH:mm`). Si viene, se usa como prefill del
   *  datetime-local en lugar de "ahora". */
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scheduledAt, setScheduledAt] = useState(defaultDate ?? nowLocalDateTime());
  const [needsTransport, setNeedsTransport] = useState(row.needsTransport);
  const [estimatedDelivery, setEstimatedDelivery] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        scheduledAt: parseLocalDateTime(scheduledAt),
        needsTransport,
      };
      if (estimatedDelivery) {
        // input type="date" — parseamos como mediodía local para no perder
        // un día por el offset UTC.
        const [y, m, d] = estimatedDelivery.split("-").map(Number);
        body.estimatedDeliveryAt = new Date(
          y,
          m - 1,
          d,
          12,
          0,
          0,
        ).toISOString();
      }
      const res = await fetch(`/api/repairs/${row.repairId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar turno</DialogTitle>
          <DialogDescription>
            {row.customerName} · {row.vehicleSummary} · {row.vehicleDomain}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Fecha y hora del turno</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <p className="text-[11px] text-slate-500">
              Al guardar se envía un mail de confirmación al cliente y el
              vehículo pasa a &quot;Turno Asignado&quot;.
            </p>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Entrega estimada (opcional)</Label>
            <Input
              type="date"
              value={estimatedDelivery}
              onChange={(e) => setEstimatedDelivery(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={needsTransport}
              onChange={(e) => setNeedsTransport(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#003b73] focus:ring-[#003b73]"
            />
            <div className="grid gap-0.5">
              <span className="text-sm font-medium text-slate-800">
                El cliente pide traslado al dejar el vehículo
              </span>
              <span className="text-[11px] text-slate-500">
                Aparece en el calendario del día del turno.
              </span>
            </div>
          </label>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !scheduledAt}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CalendarIcon className="h-4 w-4 mr-2" />
            )}
            Asignar turno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
