"use client";

import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Loader2,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CashBoxSummary } from "./caja-section";
import MovementDialog from "./movement-dialog";
import TransferDialog from "./transfer-dialog";

/**
 * spec 4.3 v2 · Caja general — vista por caja con saldo, resumen del mes y
 * botones para registrar ingresos, egresos y transferencias entre cajas.
 * Debajo se lista el movimiento del mes seleccionado (cobros + manuales).
 */

type MovementRow = {
  id: string;
  cashBox: { id: string; name: string; key: string } | null;
  type: "INGRESO" | "EGRESO" | "TRANSFER_IN" | "TRANSFER_OUT" | "COBRO";
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

      {/* Lista de movimientos */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">
            Movimientos del mes
          </h3>
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          )}
        </div>
        {error && (
          <div className="p-4 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">
            {error}
          </div>
        )}
        {movements.length === 0 && !loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No hay movimientos en este período.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {movements.map((m) => {
              const meta = TYPE_META[m.type];
              return (
                <li
                  key={m.id}
                  className="px-4 py-2.5 flex items-center gap-3 text-sm"
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
                  </div>
                  <span
                    className={`tabular-nums font-semibold shrink-0 ${
                      meta.sign > 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {meta.sign > 0 ? "+" : "−"}
                    {ARS.format(m.amount)}
                  </span>
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
