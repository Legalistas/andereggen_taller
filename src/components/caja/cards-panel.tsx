"use client";

import {
  Archive,
  CreditCard,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CashBoxSummary } from "./caja-section";

/**
 * spec Tarjetas oct '26 · Pestaña Tarjetas de la Caja.
 * Reemplaza el Excel de tarjetas: muestra cuánto hay pendiente en cada
 * tarjeta y en qué resumen (mes), permite pagar un resumen (crea el EGRESO
 * en la caja elegida) y ver las cuotas compra por compra, agrupadas por
 * proveedor o por rubro, para conciliar contra el resumen de cuenta.
 *
 * Las compras se cargan desde "Egreso" con método Tarjeta (movement-dialog).
 */

type Statement = { period: string; amount: number; count: number };
type CardRow = {
  id: string;
  name: string;
  archived: boolean;
  pendingAmount: number;
  pendingCount: number;
  statements: Statement[];
};
type Cuota = {
  id: string;
  number: number;
  total: number;
  period: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
  paidFrom: string | null;
  purchase: {
    id: string;
    date: string;
    concept: string;
    supplier: string | null;
    notes: string | null;
    reference: string | null;
    amount: number;
  };
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});
const FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});
const MES = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
/** "2026-10" → "octubre de 2026". */
const nombreResumen = (period: string) =>
  MES.format(new Date(`${period}-01T00:00:00.000Z`));

async function pedir(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json;
}

type Props = {
  boxes: CashBoxSummary[];
  /** Recarga los saldos de las cajas después de pagar un resumen. */
  onReload: () => void;
};

export default function CardsPanel({ boxes, onReload }: Props) {
  const [cards, setCards] = useState<CardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nueva, setNueva] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [pagar, setPagar] = useState<CardRow | null>(null);
  const [detalle, setDetalle] = useState<CardRow | null>(null);

  const cargar = useCallback(async () => {
    try {
      const d = await pedir("/api/caja/cards", "GET");
      setCards(d.cards);
      setError(null);
    } catch (e) {
      setCards([]);
      setError(e instanceof Error ? e.message : "Error");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const accion = async (hacer: () => Promise<unknown>) => {
    setGuardando(true);
    setError(null);
    try {
      await hacer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      await cargar();
      setGuardando(false);
    }
  };

  const total = (cards ?? []).reduce((s, c) => s + c.pendingAmount, 0);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <CreditCard className="h-4 w-4" /> Tarjetas de crédito
            </h3>
            <p className="text-xs text-slate-500">
              Pendiente en todas las tarjetas:{" "}
              <strong className="tabular-nums text-amber-700">
                {ARS.format(total)}
              </strong>
              . Las compras se cargan desde "Egreso", con método Tarjeta.
            </p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nueva.trim()) return;
              accion(async () => {
                await pedir("/api/caja/cards", "POST", { name: nueva });
                setNueva("");
              });
            }}
          >
            <Input
              className="h-8 w-48 text-xs"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder="Ej: Visa, Amex, Santa Fe"
            />
            <Button
              type="submit"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={!nueva.trim() || guardando}
            >
              <Plus className="h-3.5 w-3.5" /> Agregar tarjeta
            </Button>
          </form>
        </div>
        {error && (
          <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
      </Card>

      {cards === null ? (
        <div className="flex justify-center py-10 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : cards.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          Todavía no hay tarjetas cargadas. Agregá la primera arriba.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <Card key={c.id} className="gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {c.name}
                  </div>
                  <div
                    className={`text-xl font-bold tabular-nums ${c.pendingAmount > 0 ? "text-amber-700" : "text-slate-400"}`}
                  >
                    {ARS.format(c.pendingAmount)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {c.pendingCount === 0
                      ? "Sin cuotas pendientes"
                      : `${c.pendingCount} cuota${c.pendingCount === 1 ? "" : "s"} pendiente${c.pendingCount === 1 ? "" : "s"}`}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    title="Renombrar"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    onClick={() => {
                      const name = window.prompt(
                        "Nombre de la tarjeta",
                        c.name,
                      );
                      if (name?.trim() && name.trim() !== c.name) {
                        accion(() =>
                          pedir(`/api/caja/cards/${c.id}`, "PATCH", { name }),
                        );
                      }
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title={
                      c.pendingAmount > 0
                        ? "Pagá las cuotas pendientes antes de archivarla"
                        : "Archivar: deja de ofrecerse para compras nuevas"
                    }
                    disabled={c.pendingAmount > 0}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                    onClick={() => {
                      if (
                        window.confirm(
                          `"${c.name}" deja de aparecer para cargar compras nuevas. El historial no se toca.`,
                        )
                      ) {
                        accion(() =>
                          pedir(`/api/caja/cards/${c.id}`, "PATCH", {
                            archived: true,
                          }),
                        );
                      }
                    }}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {c.statements.length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 text-xs">
                  {c.statements.map((r) => (
                    <li
                      key={r.period}
                      className="flex items-center justify-between px-2.5 py-1.5"
                    >
                      <span className="capitalize text-slate-600">
                        {nombreResumen(r.period)}
                      </span>
                      <span className="tabular-nums font-medium text-slate-800">
                        {ARS.format(r.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1 gap-1 text-xs"
                  onClick={() => setDetalle(c)}
                >
                  <ListChecks className="h-3.5 w-3.5" /> Cuotas
                </Button>
                <Button
                  size="sm"
                  className="h-8 flex-1 text-xs"
                  disabled={c.pendingAmount <= 0}
                  onClick={() => setPagar(c)}
                >
                  Pagar resumen
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {pagar && (
        <PayDialog
          card={pagar}
          boxes={boxes}
          onClose={() => setPagar(null)}
          onSaved={() => {
            setPagar(null);
            cargar();
            onReload();
          }}
        />
      )}
      {detalle && (
        <DetailDialog
          card={detalle}
          onClose={() => {
            setDetalle(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}

// ─── Pagar un resumen ────────────────────────────────────────────────────────

const METODOS = [
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "MERCADOPAGO", label: "Mercado Pago" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTRO", label: "Otro" },
];

function PayDialog({
  card,
  boxes,
  onClose,
  onSaved,
}: {
  card: CardRow;
  boxes: CashBoxSummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // Por defecto, el resumen más viejo con cuotas pendientes. "" = todo.
  const [period, setPeriod] = useState(card.statements[0]?.period ?? "");
  const [cashBoxId, setCashBoxId] = useState(boxes[0]?.id ?? "");
  const [method, setMethod] = useState("TRANSFERENCIA");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegido = card.statements.find((r) => r.period === period);
  const monto = elegido?.amount ?? card.pendingAmount;
  const cantidad = elegido?.count ?? card.pendingCount;

  const handlePay = async () => {
    setSaving(true);
    setError(null);
    try {
      // Mediodía local: el pago queda en el día elegido en cualquier huso.
      const paidAt = new Date(`${date}T12:00:00`).toISOString();
      await pedir(`/api/caja/cards/${card.id}/pay`, "POST", {
        cashBoxId,
        paidAt,
        period: period || undefined,
        method,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pagar resumen — {card.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500">
          Se registra un egreso de{" "}
          <strong className="text-slate-800">{ARS.format(monto)}</strong> (
          {cantidad} cuota{cantidad === 1 ? "" : "s"}) en la caja elegida, y
          esas cuotas quedan pagadas.
        </p>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Resumen</Label>
            <Select
              value={period || "__todo__"}
              onValueChange={(v) => setPeriod(v === "__todo__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {card.statements.map((r) => (
                  <SelectItem key={r.period} value={r.period}>
                    <span className="capitalize">
                      {nombreResumen(r.period)}
                    </span>{" "}
                    · {ARS.format(r.amount)}
                  </SelectItem>
                ))}
                <SelectItem value="__todo__">
                  Todo lo pendiente · {ARS.format(card.pendingAmount)}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Caja que paga</Label>
            <Select value={cashBoxId} onValueChange={setCashBoxId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí la caja" />
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
              <Label className="text-xs">Fecha de pago</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METODOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && (
            <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handlePay} disabled={saving || !cashBoxId || !date}>
            {saving ? "Pagando…" : "Confirmar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cuotas de una tarjeta ───────────────────────────────────────────────────

const PENDIENTES = "__pendientes__";
const TODAS = "__todas__";
const AGRUPAR = {
  supplier: "Proveedor",
  concept: "Rubro",
  none: "Sin agrupar",
} as const;
type Agrupar = keyof typeof AGRUPAR;

function DetailDialog({
  card,
  onClose,
}: {
  card: CardRow;
  onClose: () => void;
}) {
  const [cuotas, setCuotas] = useState<Cuota[] | null>(null);
  const [resumen, setResumen] = useState(PENDIENTES);
  const [agrupar, setAgrupar] = useState<Agrupar>("supplier");
  const [buscar, setBuscar] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const d = await pedir(`/api/caja/cards/${card.id}`, "GET");
      setCuotas(d.installments);
    } catch (e) {
      setCuotas([]);
      setError(e instanceof Error ? e.message : "Error");
    }
  }, [card.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const resumenes = useMemo(
    () => [...new Set((cuotas ?? []).map((c) => c.period))].sort(),
    [cuotas],
  );

  const grupos = useMemo(() => {
    const texto = buscar.trim().toLowerCase();
    const visibles = (cuotas ?? []).filter((c) => {
      if (
        resumen === PENDIENTES
          ? c.paid
          : resumen !== TODAS && c.period !== resumen
      ) {
        return false;
      }
      if (!texto) return true;
      const { supplier, concept, notes, reference } = c.purchase;
      return [supplier, concept, notes, reference].some((v) =>
        v?.toLowerCase().includes(texto),
      );
    });
    const porClave = new Map<string, Cuota[]>();
    for (const c of visibles) {
      const clave =
        agrupar === "supplier"
          ? c.purchase.supplier?.trim() || "Sin proveedor"
          : agrupar === "concept"
            ? c.purchase.concept
            : "";
      porClave.set(clave, [...(porClave.get(clave) ?? []), c]);
    }
    return [...porClave.entries()]
      .map(([clave, filas]) => ({
        clave,
        filas,
        total: filas.reduce((s, c) => s + c.amount, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [cuotas, resumen, agrupar, buscar]);

  const total = grupos.reduce((s, g) => s + g.total, 0);
  const pendiente = grupos.reduce(
    (s, g) =>
      s + g.filas.filter((c) => !c.paid).reduce((t, c) => t + c.amount, 0),
    0,
  );

  const borrarCompra = async (c: Cuota) => {
    if (
      !window.confirm(
        `¿Borrar la compra de ${ARS.format(c.purchase.amount)} (${c.purchase.concept}) con todas sus cuotas? No se puede deshacer.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await pedir(`/api/caja/card-purchases/${c.purchase.id}`, "DELETE");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
    await cargar();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Cuotas de {card.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500">
          Cada compra con sus cuotas y el resumen en el que cae cada una, para
          conciliar contra el resumen de cuenta.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1">
            <Label className="text-xs">Resumen</Label>
            <Select value={resumen} onValueChange={setResumen}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PENDIENTES}>Todo lo pendiente</SelectItem>
                <SelectItem value={TODAS}>Todas las cuotas</SelectItem>
                {resumenes.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {nombreResumen(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Agrupar por</Label>
            <Select
              value={agrupar}
              onValueChange={(v) => setAgrupar(v as Agrupar)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AGRUPAR).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Buscar</Label>
            <Input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Proveedor, producto o rubro"
            />
          </div>
        </div>

        {error && (
          <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {cuotas === null ? (
          <div className="flex justify-center py-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : grupos.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            No hay cuotas para mostrar.
          </p>
        ) : (
          <div className="max-h-[50vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compra</TableHead>
                  <TableHead>
                    {agrupar === "concept" ? "Proveedor" : "Rubro"}
                  </TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Cuota</TableHead>
                  <TableHead>Resumen</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupos.map((g) => (
                  <GrupoDeCuotas
                    key={g.clave}
                    {...g}
                    agrupar={agrupar}
                    onBorrar={borrarCompra}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm text-slate-500">
          <span>
            Total mostrado{" "}
            <strong className="tabular-nums text-slate-800">
              {ARS.format(total)}
            </strong>
          </span>
          <span>
            Pendiente{" "}
            <strong className="tabular-nums text-amber-700">
              {ARS.format(pendiente)}
            </strong>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GrupoDeCuotas({
  clave,
  filas,
  total,
  agrupar,
  onBorrar,
}: {
  clave: string;
  filas: Cuota[];
  total: number;
  agrupar: Agrupar;
  onBorrar: (c: Cuota) => void;
}) {
  return (
    <>
      {agrupar !== "none" && (
        <TableRow className="bg-slate-50 hover:bg-slate-50">
          <TableCell colSpan={5} className="text-xs font-semibold">
            {clave} · {filas.length} cuota{filas.length === 1 ? "" : "s"}
          </TableCell>
          <TableCell className="text-right text-xs font-semibold tabular-nums">
            {ARS.format(total)}
          </TableCell>
          <TableCell colSpan={2} />
        </TableRow>
      )}
      {filas.map((c) => (
        <TableRow key={c.id}>
          <TableCell className="whitespace-nowrap text-xs tabular-nums">
            {FECHA.format(new Date(c.purchase.date))}
          </TableCell>
          <TableCell className="text-xs">
            {agrupar === "concept"
              ? c.purchase.supplier || "—"
              : c.purchase.concept}
          </TableCell>
          <TableCell className="max-w-56 text-xs">
            <span className="block truncate">
              {agrupar === "none" && c.purchase.supplier
                ? `${c.purchase.supplier} · `
                : ""}
              {c.purchase.notes || c.purchase.reference || "—"}
            </span>
          </TableCell>
          <TableCell className="whitespace-nowrap text-xs tabular-nums">
            {c.number}/{c.total}
          </TableCell>
          <TableCell className="whitespace-nowrap text-xs capitalize">
            {nombreResumen(c.period)}
          </TableCell>
          <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">
            {ARS.format(c.amount)}
          </TableCell>
          <TableCell className="whitespace-nowrap text-xs">
            {c.paid ? (
              <Badge variant="secondary" className="font-normal">
                Pagada
                {c.paidAt ? ` ${FECHA.format(new Date(c.paidAt))}` : ""}
                {c.paidFrom ? ` · ${c.paidFrom}` : ""}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-300 font-normal text-amber-700"
              >
                Pendiente
              </Badge>
            )}
          </TableCell>
          <TableCell className="w-8">
            {/* Una compra se borra desde su primera cuota, si no pagó ninguna. */}
            {c.number === 1 && !c.paid && (
              <button
                type="button"
                title="Borrar la compra con todas sus cuotas"
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                onClick={() => onBorrar(c)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
