"use client";

import { CheckCircle2, Clock3, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CashBoxSummary } from "./caja-section";

/**
 * spec v2 · Pagos preparados / para realizar.
 * Lista los pagos anotados como "los vamos a pagar pero todavía no
 * retiramos la plata". Botón "Retirar" materializa el pago (crea un
 * CashMovement EGRESO en la caja y marca el pendiente como pagado).
 */

type PendingRow = {
  id: string;
  cashBox: { id: string; key: string; name: string } | null;
  amount: number;
  method: string;
  concept: string;
  reference: string | null;
  notes: string | null;
  dueDate: string | null;
  status: "PENDIENTE" | "PAGADO" | "CANCELADO";
  paidAt: string | null;
  createdBy: string | null;
  createdAt: string;
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const DATE_FMT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const METHODS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "MERCADOPAGO", label: "Mercado Pago" },
  { value: "OTRO", label: "Otro" },
];

function localNoonISO(v: string): string {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

type Props = {
  boxes: CashBoxSummary[];
  onChanged: () => void;
};

export default function PendingPaymentsPanel({ boxes, onChanged }: Props) {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRows = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/caja/pending", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as { rows: PendingRow[] };
      setRows(d.rows);
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
    fetchRows(ac.signal);
    return () => ac.abort();
  }, [fetchRows]);

  const total = rows.reduce((a, r) => a + r.amount, 0);

  const markPaid = async (row: PendingRow) => {
    if (
      !window.confirm(
        `¿Registrar el pago de ${ARS.format(row.amount)} de ${row.cashBox?.name ?? "caja"}? Esto crea un EGRESO real en la caja.`,
      )
    )
      return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/caja/pending/${row.id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      await fetchRows();
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const cancelRow = async (row: PendingRow) => {
    if (!window.confirm(`¿Cancelar el pago de ${ARS.format(row.amount)}?`))
      return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/caja/pending/${row.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      await fetchRows();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-700">
            Pagos preparados
          </h3>
          {rows.length > 0 && (
            <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
              {rows.length} · {ARS.format(total)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nuevo pago
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">
          {error}
        </div>
      )}

      {rows.length === 0 && !loading ? (
        <div className="p-6 text-center text-sm text-slate-500">
          No hay pagos preparados. Anotá acá lo que sepas que van a pagar
          (proveedores, sueldos) antes de retirar la plata de la caja.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const busy = busyId === r.id;
            return (
              <li
                key={r.id}
                className="px-4 py-2.5 flex items-center gap-3 text-sm group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-900 truncate">
                    {r.concept}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {r.cashBox?.name ?? "—"} ·{" "}
                    {METHODS.find((m) => m.value === r.method)?.label ??
                      r.method}
                    {r.dueDate &&
                      ` · Vence ${DATE_FMT.format(new Date(r.dueDate))}`}
                    {r.createdBy && ` · ${r.createdBy}`}
                  </div>
                  {r.notes && (
                    <div className="text-[11px] text-slate-600 mt-0.5 whitespace-pre-wrap wrap-break-word">
                      {r.notes}
                    </div>
                  )}
                </div>
                <span className="tabular-nums font-semibold shrink-0 text-rose-700">
                  −{ARS.format(r.amount)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markPaid(r)}
                  disabled={busy}
                  className="shrink-0 h-8"
                  title="Marcar como retirado — crea un EGRESO en la caja"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  )}
                  Retirar
                </Button>
                <button
                  type="button"
                  onClick={() => cancelRow(r)}
                  disabled={busy}
                  aria-label="Cancelar / borrar"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {dialogOpen && (
        <NewPendingDialog
          boxes={boxes}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            fetchRows();
          }}
        />
      )}
    </Card>
  );
}

function NewPendingDialog({
  boxes,
  onClose,
  onSaved,
}: {
  boxes: CashBoxSummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cashBoxId, setCashBoxId] = useState(boxes[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("EFECTIVO");
  const [concept, setConcept] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    Number(amount) > 0 && concept.trim().length > 0 && cashBoxId && !saving;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/caja/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashBoxId,
          amount: Number(amount),
          method,
          concept,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          dueDate: dueDate ? localNoonISO(dueDate) : null,
        }),
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
          <DialogTitle>Nuevo pago preparado</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Caja</Label>
            <Select value={cashBoxId} onValueChange={setCashBoxId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {boxes.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Importe</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Concepto</Label>
            <Input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej: Sueldo María, Alquiler julio, Brixar"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Vencimiento (opcional)</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Referencia</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Comprobante / Nº"
              />
            </div>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Notas</Label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Aclaraciones — a quién, para qué, etc."
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003b73]/30 focus:border-[#003b73] resize-y"
            />
          </div>

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
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Guardar pendiente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
