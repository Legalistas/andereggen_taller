"use client";

import {
  ArrowRight,
  ArrowRightLeft,
  Calendar as CalendarIcon,
  Loader2,
  LogIn,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
 * spec 2.3 v2 · Modal de detalle de un evento del calendario. Muestra el
 * turno o la entrega con datos del cliente/vehículo y permite editar la
 * fecha/hora + el flag de traslado sin salir del módulo.
 *
 * Para eventos de tipo "ingreso" edita `scheduledAt` (input datetime-local).
 * Para "entrega" edita `estimatedDeliveryAt` (input date, sin hora — nunca
 * pactamos hora exacta de entrega con el cliente).
 */

export type EventDialogInput = {
  repairId: string;
  kind: "ingreso" | "entrega";
  internalNumber: number | null;
  customerName: string;
  vehicleSummary: string;
  vehicleDomain: string;
  date: string;
  needsTransport: boolean;
  status: string;
};

type Props = {
  event: EventDialogInput;
  onClose: () => void;
  onSaved: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  turno_a_asignar: "Turno a Asignar",
  turno_asignado: "Turno Asignado",
  ingresado: "Ingresado",
  pendientes_repuestos: "Pendientes de Repuestos",
  chapa: "Chapa",
  pintura: "Pintura",
  calidad: "Calidad",
  pendientes_cobro: "Pendientes de Cobro",
  experiencia_cliente: "Experiencia del Cliente",
  archivado: "Archivado",
};

/** ISO → `YYYY-MM-DDTHH:mm` local para `datetime-local`. */
function toLocalDateTime(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** ISO → `YYYY-MM-DD` local para `date`. */
function toLocalDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDateTime(v: string): string {
  const [datePart, timePart] = v.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0).toISOString();
}

function parseLocalDate(v: string): string {
  const [y, m, d] = v.split("-").map(Number);
  // Mediodía local para evitar saltos por DST/timezone.
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export default function EventDetailDialog({ event, onClose, onSaved }: Props) {
  const isTurno = event.kind === "ingreso";
  const Icon = isTurno ? LogIn : LogOut;
  const title = isTurno ? "Detalle del turno" : "Detalle de la entrega";

  const [dateValue, setDateValue] = useState(
    isTurno ? toLocalDateTime(event.date) : toLocalDate(event.date),
  );
  const [needsTransport, setNeedsTransport] = useState(event.needsTransport);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si cambia el evento (mismo dialog reutilizado), reseteamos el form
  useEffect(() => {
    setDateValue(
      isTurno ? toLocalDateTime(event.date) : toLocalDate(event.date),
    );
    setNeedsTransport(event.needsTransport);
    setError(null);
  }, [event, isTurno]);

  const isDirty =
    dateValue !==
      (isTurno ? toLocalDateTime(event.date) : toLocalDate(event.date)) ||
    needsTransport !== event.needsTransport;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        needsTransport,
      };
      if (isTurno) {
        body.scheduledAt = parseLocalDateTime(dateValue);
      } else {
        body.estimatedDeliveryAt = parseLocalDate(dateValue);
      }
      const res = await fetch(`/api/repairs/${event.repairId}`, {
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
          <DialogTitle className="flex items-center gap-2">
            <Icon
              className={`h-4 w-4 ${isTurno ? "text-blue-600" : "text-emerald-600"}`}
            />
            {title}
            {event.internalNumber !== null && (
              <span className="text-xs font-normal text-slate-500 tabular-nums">
                #{event.internalNumber}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {event.customerName} · {event.vehicleSummary} ·{" "}
            {event.vehicleDomain}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            Estado actual del vehículo
          </div>
          <div className="text-sm font-medium text-slate-800 -mt-2">
            {STATUS_LABEL[event.status] ?? event.status}
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">
              {isTurno ? "Fecha y hora del turno" : "Fecha estimada de entrega"}
            </Label>
            <Input
              type={isTurno ? "datetime-local" : "date"}
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
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
              <span className="text-sm font-medium text-slate-800 inline-flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3 text-amber-600" />
                El cliente pide traslado al dejar el vehículo
              </span>
              <span className="text-[11px] text-slate-500">
                Marcar si hay que llevarlo a su domicilio o trabajo.
              </span>
            </div>
          </label>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          <Link
            href={`/produccion?repairId=${event.repairId}`}
            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 hover:underline"
          >
            Ver ficha completa
            <ArrowRight className="h-3 w-3" />
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cerrar
            </Button>
            <Button onClick={handleSave} disabled={saving || !isDirty}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CalendarIcon className="h-4 w-4 mr-2" />
              )}
              Guardar cambios
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
