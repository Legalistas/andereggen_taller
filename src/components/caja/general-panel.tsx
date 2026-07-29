"use client";

import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Loader2,
  Trash2,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CashBoxSummary } from "./caja-section";
import MovementDialog from "./movement-dialog";
import PendingPaymentsPanel from "./pending-payments-panel";
import TransferDialog from "./transfer-dialog";

/**
 * spec 4.3 v2 · Caja general — vista por caja con saldo, resumen del mes y
 * botones para registrar ingresos, egresos y transferencias entre cajas.
 * Debajo se lista el movimiento del mes seleccionado (cobros + manuales).
 */

type MovementRow = {
  id: string;
  cashBox: { id: string; name: string; key: string } | null;
  type:
    | "INGRESO"
    | "EGRESO"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "PASE_IN"
    | "PASE_OUT"
    | "COBRO";
  amount: number;
  method: string;
  concept: string;
  reference: string | null;
  notes: string | null;
  paidAt: string;
  createdBy: string | null;
  source: "manual" | "payment";
  transferGroupId: string | null;
  linkedRepair: {
    id: string;
    internalNumber: number | null;
    customerName: string;
    vehicleDomain: string;
  } | null;
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const METHOD_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
  TARJETA: "Tarjeta",
  MERCADOPAGO: "Mercado Pago",
  OTRO: "Otro",
};

const TYPE_META: Record<
  MovementRow["type"],
  { label: string; sign: 1 | -1; color: string }
> = {
  INGRESO: {
    label: "Ingreso",
    sign: 1,
    color: "bg-emerald-100 text-emerald-700",
  },
  COBRO: {
    label: "Cobro",
    sign: 1,
    color: "bg-blue-100 text-blue-700",
  },
  TRANSFER_IN: {
    label: "Transf. entra",
    sign: 1,
    color: "bg-slate-100 text-slate-700",
  },
  EGRESO: {
    label: "Egreso",
    sign: -1,
    color: "bg-rose-100 text-rose-700",
  },
  TRANSFER_OUT: {
    label: "Transf. sale",
    sign: -1,
    color: "bg-slate-100 text-slate-700",
  },
  PASE_IN: {
    label: "Pase entra",
    sign: 1,
    color: "bg-violet-100 text-violet-700",
  },
  PASE_OUT: {
    label: "Pase sale",
    sign: -1,
    color: "bg-violet-100 text-violet-700",
  },
};

const DATE_FMT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type Props = {
  boxes: CashBoxSummary[];
  monthParam: string;
  onReload: () => void;
};

export default function GeneralPanel({ boxes, monthParam, onReload }: Props) {
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [movementDialog, setMovementDialog] = useState<{
    open: boolean;
    type: "INGRESO" | "EGRESO";
    cashBoxId: string | null;
  } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // spec v2 · Filtro por concepto (útil para ver "cuánto gastamos en
  // Brixar / Sueldos / Fletes este mes"). "all" = sin filtro.
  const [conceptFilter, setConceptFilter] = useState<string>("all");

  const fetchMovements = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ month: monthParam });
      if (selectedBoxId) params.set("cashBoxId", selectedBoxId);
      try {
        const res = await fetch(`/api/caja/movements?${params.toString()}`, {
          signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = (await res.json()) as { rows: MovementRow[] };
        setMovements(d.rows);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Error");
        }
      } finally {
        setLoading(false);
      }
    },
    [monthParam, selectedBoxId],
  );

  useEffect(() => {
    const ac = new AbortController();
    fetchMovements(ac.signal);
    return () => ac.abort();
  }, [fetchMovements]);

  const reloadAll = () => {
    onReload();
    fetchMovements();
  };

  // spec v2 · Resumen de EGRESOS del mes agrupados por concepto (para ver
  // "cuánto pagamos en Brixar / Sueldos / Fletes" de un vistazo) + lista de
  // conceptos únicos para el filtro. Sólo egresos manuales — los cobros no
  // aplican a "rubro".
  const egresoConcepts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movements) {
      if (m.type !== "EGRESO") continue;
      map.set(m.concept, (map.get(m.concept) ?? 0) + m.amount);
    }
    return Array.from(map.entries())
      .map(([concept, total]) => ({ concept, total }))
      .sort((a, b) => b.total - a.total);
  }, [movements]);

  const filteredMovements = useMemo(() => {
    if (conceptFilter === "all") return movements;
    return movements.filter(
      (m) => m.type === "EGRESO" && m.concept === conceptFilter,
    );
  }, [movements, conceptFilter]);

  const deleteRow = async (m: MovementRow) => {
    // El id local viene prefijado por el GET (mov-… o pay-…) para distinguir
    // manual movements de cobros de factura. Rutamos a la API correcta y
    // avisamos al usuario si el borrado del cobro dispara reapertura del
    // repair (paso de archivado → pendientes_cobro).
    const isPayment = m.source === "payment";
    const rawId = m.id.replace(/^(mov-|pay-)/, "");
    const kind = isPayment ? "el cobro" : "el movimiento";
    if (
      !window.confirm(
        `¿Borrar ${kind} de ${ARS.format(m.amount)}? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setDeletingId(m.id);
    try {
      const url = isPayment
        ? `/api/caja/payments/${rawId}`
        : `/api/caja/movements/${rawId}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json().catch(() => ({}))) as {
        restored?: boolean;
      };
      if (data.restored) {
        window.alert(
          "El cobro fue eliminado. El vehículo volvió a 'Pendientes de Cobro'.",
        );
      }
      reloadAll();
    } catch (e) {
      window.alert(
        e instanceof Error ? `No se pudo borrar: ${e.message}` : "Error",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cajas: click filtra el listado; botones + para ingreso/egreso; global para transferencia */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {boxes.map((box) => {
          const active = selectedBoxId === box.id;
          return (
            <Card
              key={box.id}
              className={`p-3 transition ${
                active
                  ? "border-[#003b73] ring-2 ring-[#003b73]/20"
                  : "hover:border-slate-300"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  setSelectedBoxId((id) => (id === box.id ? null : box.id))
                }
                className="w-full text-left"
                aria-pressed={active}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {box.name}
                    </div>
                    {box.description && (
                      <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                        {box.description}
                      </div>
                    )}
                  </div>
                  <Wallet className="h-4 w-4 text-slate-400 shrink-0" />
                </div>
                <div className="mt-2 text-xl font-bold text-slate-900 tabular-nums">
                  {ARS.format(box.balance)}
                </div>
                <div className="text-[10px] text-slate-500 mt-2 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Cobros mes</span>
                    <span className="tabular-nums text-emerald-700">
                      {ARS.format(box.month.collections + box.month.ingresos)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Egresos mes</span>
                    <span className="tabular-nums text-rose-700">
                      {ARS.format(box.month.egresos)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transf. mes</span>
                    <span className="tabular-nums text-slate-700">
                      +{ARS.format(box.month.transfersIn)} / -
                      {ARS.format(box.month.transfersOut)}
                    </span>
                  </div>
                  {(box.month.pasesIn > 0 || box.month.pasesOut > 0) && (
                    <div className="flex justify-between">
                      <span>Pases mes</span>
                      <span className="tabular-nums text-violet-700">
                        +{ARS.format(box.month.pasesIn)} / -
                        {ARS.format(box.month.pasesOut)}
                      </span>
                    </div>
                  )}
                  {/* spec v2 · Diferencia neta del mes (ingresos − egresos
                      neto de transferencias y pases). Sirve para chequear
                      que los importes de la caja del mes cierren. */}
                  {(() => {
                    const saldoMes =
                      box.month.collections +
                      box.month.ingresos +
                      box.month.transfersIn +
                      box.month.pasesIn -
                      box.month.egresos -
                      box.month.transfersOut -
                      box.month.pasesOut;
                    return (
                      <div className="flex justify-between pt-1 mt-1 border-t border-slate-100">
                        <span className="font-semibold text-slate-700">
                          Saldo del mes
                        </span>
                        <span
                          className={`tabular-nums font-semibold ${
                            saldoMes >= 0
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {saldoMes >= 0 ? "+" : "−"}
                          {ARS.format(Math.abs(saldoMes))}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </button>
              <div className="flex items-center gap-1 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-[11px] h-7"
                  onClick={() =>
                    setMovementDialog({
                      open: true,
                      type: "INGRESO",
                      cashBoxId: box.id,
                    })
                  }
                >
                  <ArrowDown className="h-3 w-3 mr-1 text-emerald-600" />
                  Ingreso
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-[11px] h-7"
                  onClick={() =>
                    setMovementDialog({
                      open: true,
                      type: "EGRESO",
                      cashBoxId: box.id,
                    })
                  }
                >
                  <ArrowUp className="h-3 w-3 mr-1 text-rose-600" />
                  Egreso
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* spec v2 · Pagos preparados / para realizar (entre cajas y
          movimientos del mes). Al retirar la plata se crea un EGRESO real
          en la caja, por eso recargamos también las cajas. */}
      <PendingPaymentsPanel boxes={boxes} onChanged={reloadAll} />

      {/* Acciones globales */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTransferOpen(true)}
        >
          <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
          Nueva transferencia
        </Button>
        {selectedBoxId && (
          <div className="text-xs text-slate-500 ml-auto">
            Filtrando movimientos por caja seleccionada ·{" "}
            <button
              type="button"
              onClick={() => setSelectedBoxId(null)}
              className="text-[#003b73] hover:underline"
            >
              limpiar
            </button>
          </div>
        )}
      </div>

      {/* spec v2 · Egresos por rubro del mes — para ver rápido cuánto se
          gastó en cada concepto (Brixar, Sueldos, etc.). Click en un chip
          filtra el listado. */}
      {egresoConcepts.length > 0 && (
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
            Egresos del mes por rubro
          </div>
          <div className="flex flex-wrap gap-1.5">
            {egresoConcepts.map((c) => {
              const active = conceptFilter === c.concept;
              return (
                <button
                  key={c.concept}
                  type="button"
                  onClick={() =>
                    setConceptFilter(active ? "all" : c.concept)
                  }
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition ${
                    active
                      ? "border-[#003b73] bg-[#003b73] text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                  title={`Filtrar movimientos por "${c.concept}"`}
                >
                  <span>{c.concept}</span>
                  <span
                    className={`tabular-nums font-semibold ${
                      active ? "text-white" : "text-rose-700"
                    }`}
                  >
                    {ARS.format(c.total)}
                  </span>
                </button>
              );
            })}
            {conceptFilter !== "all" && (
              <button
                type="button"
                onClick={() => setConceptFilter("all")}
                className="text-[11px] text-[#003b73] hover:underline px-1"
              >
                limpiar filtro
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Lista de movimientos */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-700">
              Movimientos del mes
            </h3>
            {selectedBoxId && (
              <span className="text-[11px] bg-[#003b73]/10 text-[#003b73] px-2 py-0.5 rounded">
                {boxes.find((b) => b.id === selectedBoxId)?.name ?? "Caja"}
              </span>
            )}
            {conceptFilter !== "all" && (
              <span className="text-[11px] bg-[#003b73]/10 text-[#003b73] px-2 py-0.5 rounded">
                Filtrando: {conceptFilter}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            )}
            {/* spec v2 · Filtro por caja — sincronizado con el toggle de
                las cards de arriba (mismo `selectedBoxId`). Server-side. */}
            <Select
              value={selectedBoxId ?? "all"}
              onValueChange={(v) =>
                setSelectedBoxId(v === "all" ? null : v)
              }
            >
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cajas</SelectItem>
                {boxes.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={conceptFilter} onValueChange={setConceptFilter}>
              <SelectTrigger className="h-8 text-xs w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los conceptos</SelectItem>
                {egresoConcepts.map((c) => (
                  <SelectItem key={c.concept} value={c.concept}>
                    {c.concept} · {ARS.format(c.total)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {error && (
          <div className="p-4 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">
            {error}
          </div>
        )}
        {filteredMovements.length === 0 && !loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {conceptFilter === "all"
              ? "No hay movimientos en este período."
              : `No hay egresos en "${conceptFilter}" este mes.`}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredMovements.map((m) => {
              const meta = TYPE_META[m.type];
              const isDeleting = deletingId === m.id;
              return (
                <li
                  key={m.id}
                  className="px-4 py-2.5 flex items-center gap-3 text-sm group"
                >
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${meta.color} shrink-0`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-xs text-slate-600 tabular-nums shrink-0">
                    {DATE_FMT.format(new Date(m.paidAt))}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900 truncate">
                      {m.concept}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {m.cashBox?.name ?? "—"} ·{" "}
                      {METHOD_LABEL[m.method] ?? m.method}
                      {m.reference && ` · Ref: ${m.reference}`}
                      {m.createdBy && ` · ${m.createdBy}`}
                    </div>
                    {m.notes && (
                      <div
                        className="text-[11px] text-slate-600 mt-0.5 whitespace-pre-wrap wrap-break-word"
                        title={m.notes}
                      >
                        {m.notes}
                      </div>
                    )}
                  </div>
                  <span
                    className={`tabular-nums font-semibold shrink-0 ${
                      meta.sign > 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {meta.sign > 0 ? "+" : "−"}
                    {ARS.format(m.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteRow(m)}
                    disabled={isDeleting}
                    aria-label={
                      m.source === "payment"
                        ? "Borrar cobro"
                        : "Borrar movimiento"
                    }
                    title={
                      m.source === "payment"
                        ? "Borrar cobro (revierte el auto-archivado si aplica)"
                        : m.transferGroupId
                          ? "Borrar transferencia (elimina ambas contrapartes)"
                          : "Borrar movimiento"
                    }
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 rounded p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {movementDialog?.open && movementDialog.cashBoxId && (
        <MovementDialog
          type={movementDialog.type}
          cashBoxId={movementDialog.cashBoxId}
          boxes={boxes}
          onClose={() => setMovementDialog(null)}
          onSaved={() => {
            setMovementDialog(null);
            reloadAll();
          }}
        />
      )}
      {transferOpen && (
        <TransferDialog
          boxes={boxes}
          onClose={() => setTransferOpen(false)}
          onSaved={() => {
            setTransferOpen(false);
            reloadAll();
          }}
        />
      )}
    </div>
  );
}
