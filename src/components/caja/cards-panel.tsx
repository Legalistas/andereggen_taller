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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MAX_CUOTAS, periodoPrimeraCuota, repartirCuotas } from "@/lib/cuotas";
import type { CashBoxSummary } from "./caja-section";
import { useCashConcepts } from "./use-cash-concepts";

/**
 * spec Tarjetas oct '26 · Pestaña Tarjetas de la Caja.
 * Reemplaza el Excel de tarjetas y funciona como en el backoffice de
 * Legalistas: cada tarjeta tiene su día de cierre y de vencimiento; una
 * compra se reparte en cuotas, una por resumen (mes); y al pagar un resumen
 * se crea el EGRESO en la caja elegida. Las cuotas se ven compra por compra,
 * agrupadas por proveedor o por rubro, para conciliar contra el resumen.
 *
 * La compra se registra acá o desde "Egreso" con método Tarjeta.
 */

type Statement = {
  period: string;
  dueDate: string | null;
  amount: number;
  count: number;
};
type CardRow = {
  id: string;
  name: string;
  closingDay: number | null;
  dueDay: number | null;
  archived: boolean;
  pendingAmount: number;
  pendingCount: number;
  statements: Statement[];
};
type Compra = {
  id: string;
  date: string;
  concept: string;
  supplier: string | null;
  notes: string | null;
  reference: string | null;
  amount: number;
  installments: number;
  paidInstallments: number;
  firstPeriod: string | null;
  createdBy: string | null;
};
type Cuota = {
  id: string;
  number: number;
  total: number;
  period: string;
  dueDate: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
  paidFrom: string | null;
  purchaseId: string;
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
// Los vencimientos son "solo día" (medianoche UTC): se muestran en UTC.
const VENCE = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});
const MES = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
/** "2026-10" → "octubre de 2026". */
const nombreResumen = (period: string) =>
  MES.format(new Date(`${period}-01T00:00:00.000Z`));

const hoyISO = () => new Date().toISOString().slice(0, 10);
/** "AAAA-MM-DD" → ISO al mediodía local: queda en ese día en cualquier huso. */
const mediodia = (dia: string) => new Date(`${dia}T12:00:00`).toISOString();

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

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {error}
    </div>
  );
}

type Props = {
  boxes: CashBoxSummary[];
  /** Recarga los saldos de las cajas después de pagar un resumen. */
  onReload: () => void;
};

export default function CardsPanel({ boxes, onReload }: Props) {
  const [cards, setCards] = useState<CardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editar, setEditar] = useState<CardRow | "nueva" | null>(null);
  const [comprar, setComprar] = useState(false);
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

  const archivar = async (c: CardRow) => {
    if (
      !window.confirm(
        `"${c.name}" deja de aparecer para cargar compras nuevas. El historial no se toca.`,
      )
    ) {
      return;
    }
    try {
      await pedir(`/api/caja/cards/${c.id}`, "PATCH", { archived: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
    await cargar();
  };

  const total = (cards ?? []).reduce((s, c) => s + c.pendingAmount, 0);

  return (
    <div className="space-y-4">
      <Card className="gap-3 p-4">
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
              . Una compra con tarjeta no sale de ninguna caja hasta que se paga
              su resumen.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => setEditar("nueva")}
            >
              <Plus className="h-3.5 w-3.5" /> Nueva tarjeta
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={!cards?.length}
              onClick={() => setComprar(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Registrar compra
            </Button>
          </div>
        </div>
        <ErrorBox error={error} />
      </Card>

      {cards === null ? (
        <div className="flex justify-center py-10 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : cards.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          Todavía no hay tarjetas cargadas. Empezá por "Nueva tarjeta".
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
                  <div className="text-[11px] text-slate-500">
                    {c.closingDay
                      ? `Cierra el ${c.closingDay}`
                      : "Sin día de cierre"}
                    {c.dueDay ? ` · vence el ${c.dueDay}` : ""}
                  </div>
                  <div
                    className={`mt-1 text-xl font-bold tabular-nums ${c.pendingAmount > 0 ? "text-amber-700" : "text-slate-400"}`}
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
                    title="Editar: nombre, día de cierre y de vencimiento"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    onClick={() => setEditar(c)}
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
                    onClick={() => archivar(c)}
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
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5"
                    >
                      <span className="text-slate-600">
                        <span className="capitalize">
                          {nombreResumen(r.period)}
                        </span>
                        {r.dueDate && (
                          <span className="text-slate-400">
                            {" "}
                            · vence {VENCE.format(new Date(r.dueDate))}
                          </span>
                        )}
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
                  <ListChecks className="h-3.5 w-3.5" /> Cuotas y compras
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

      {editar && (
        <CardDialog
          card={editar === "nueva" ? null : editar}
          onClose={() => setEditar(null)}
          onSaved={() => {
            setEditar(null);
            cargar();
          }}
        />
      )}
      {comprar && cards && (
        <PurchaseDialog
          cards={cards}
          onClose={() => setComprar(false)}
          onSaved={() => {
            setComprar(false);
            cargar();
          }}
        />
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

// ─── Alta / edición de una tarjeta ───────────────────────────────────────────

function CardDialog({
  card,
  onClose,
  onSaved,
}: {
  card: CardRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(card?.name ?? "");
  const [closingDay, setClosingDay] = useState(
    card?.closingDay ? String(card.closingDay) : "",
  );
  const [dueDay, setDueDay] = useState(card?.dueDay ? String(card.dueDay) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name,
        closingDay: closingDay || null,
        dueDay: dueDay || null,
      };
      if (card) await pedir(`/api/caja/cards/${card.id}`, "PATCH", body);
      else await pedir("/api/caja/cards", "POST", body);
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
          <DialogTitle>{card ? "Editar tarjeta" : "Nueva tarjeta"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Visa, Amex, Mercado Pago, Santa Fe"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Día de cierre</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
                placeholder="Ej: 25"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Día de vencimiento</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="Ej: 5"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Con el día de cierre, cada compra cae sola en el resumen que
            corresponde: hasta ese día entra en el del mes; después, en el del
            mes siguiente. Sin cargarlo, la primera cuota va al mes siguiente.
            {card
              ? " Los cambios valen para las compras nuevas; las ya cargadas no se mueven de resumen."
              : ""}
          </p>
          <ErrorBox error={error} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Registrar una compra ────────────────────────────────────────────────────

const OTRO = "__otro__";

function PurchaseDialog({
  cards,
  onClose,
  onSaved,
}: {
  cards: CardRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [date, setDate] = useState(hoyISO());
  const [amount, setAmount] = useState("");
  const [cuotas, setCuotas] = useState("1");
  // Vacío = el resumen que le toca según el día de cierre de la tarjeta.
  const [primerResumen, setPrimerResumen] = useState("");
  const [rubro, setRubro] = useState("");
  const concepts = useCashConcepts();
  const [rubroLibre, setRubroLibre] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const card = cards.find((c) => c.id === cardId);
  const concept = rubro === OTRO ? rubroLibre.trim() : rubro;
  const monto = Number(amount);
  const cuotasNum = Math.min(
    MAX_CUOTAS,
    Math.max(1, Math.trunc(Number(cuotas)) || 1),
  );
  const resumenPorDefecto = date
    ? periodoPrimeraCuota(
        new Date(`${date}T00:00:00.000Z`),
        card?.closingDay ?? null,
      )
    : "";

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await pedir("/api/caja/card-purchases", "POST", {
        creditCardId: cardId,
        amount: monto,
        concept,
        supplier,
        notes,
        purchasedAt: mediodia(date),
        installments: cuotasNum,
        firstPeriod: primerResumen || undefined,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar compra con tarjeta</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Tarjeta</Label>
              <Select value={cardId} onValueChange={setCardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí la tarjeta" />
                </SelectTrigger>
                <SelectContent>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Fecha de la compra</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Importe total</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Cuotas</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_CUOTAS}
                value={cuotas}
                onChange={(e) => setCuotas(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Primer resumen</Label>
              <Input
                type="month"
                value={primerResumen || resumenPorDefecto}
                onChange={(e) => setPrimerResumen(e.target.value)}
              />
            </div>
          </div>
          {monto > 0 && (
            <p className="text-[11px] text-slate-500">
              {cuotasNum > 1
                ? `${cuotasNum} cuotas de ${ARS.format(repartirCuotas(monto, cuotasNum)[0])}, una por resumen`
                : "Un solo pago"}
              {resumenPorDefecto || primerResumen
                ? `, desde ${nombreResumen(primerResumen || resumenPorDefecto)}.`
                : "."}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Rubro</Label>
              <Select value={rubro} onValueChange={setRubro}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí el rubro" />
                </SelectTrigger>
                <SelectContent>
                  {concepts.map((c) => (
                    <SelectItem key={c.label} value={c.label}>
                      {c.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTRO}>Otro…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Proveedor</Label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="A quién se le compró"
              />
            </div>
          </div>
          {rubro === OTRO && (
            <Input
              value={rubroLibre}
              onChange={(e) => setRubroLibre(e.target.value)}
              placeholder="Rubro"
            />
          )}
          <div className="grid gap-1">
            <Label className="text-xs">Qué se compró</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Producto o detalle"
            />
          </div>
          <ErrorBox error={error} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !cardId || !date || !(monto > 0) || !concept}
          >
            {saving ? "Guardando…" : "Registrar compra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [date, setDate] = useState(hoyISO());
  // Vacío = la suma de las cuotas. Se puede pagar de más (intereses, cargos).
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegido = card.statements.find((r) => r.period === period);
  const total = elegido?.amount ?? card.pendingAmount;
  const cantidad = elegido?.count ?? card.pendingCount;
  const pagado = amount === "" ? total : Number(amount);
  const cargos = Math.round((pagado - total) * 100) / 100;

  const handlePay = async () => {
    setSaving(true);
    setError(null);
    try {
      await pedir(`/api/caja/cards/${card.id}/pay`, "POST", {
        cashBoxId,
        paidAt: mediodia(date),
        period: period || undefined,
        amount: amount === "" ? undefined : pagado,
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
          Se registra un egreso en la caja elegida y quedan pagadas las{" "}
          {cantidad} cuota{cantidad === 1 ? "" : "s"} del resumen (
          <strong className="text-slate-800">{ARS.format(total)}</strong>).
        </p>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Resumen</Label>
            <Select
              value={period || "__todo__"}
              onValueChange={(v) => {
                setPeriod(v === "__todo__" ? "" : v);
                setAmount("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {card.statements.map((r) => (
                  <SelectItem key={r.period} value={r.period}>
                    <span className="capitalize">
                      {nombreResumen(r.period)}
                    </span>
                    {r.dueDate
                      ? ` · vence ${VENCE.format(new Date(r.dueDate))}`
                      : ""}{" "}
                    · {ARS.format(r.amount)}
                  </SelectItem>
                ))}
                <SelectItem value="__todo__">
                  Todo lo pendiente · {ARS.format(card.pendingAmount)}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Importe pagado</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(total)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Fecha de pago</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          {cargos > 0 && (
            <p className="text-[11px] text-slate-500">
              Incluye {ARS.format(cargos)} de intereses o cargos del resumen.
            </p>
          )}
          {cargos < -0.01 && (
            <p className="text-[11px] text-rose-700">
              El pago tiene que cubrir las cuotas del resumen (
              {ARS.format(total)}).
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
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
          <ErrorBox error={error} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handlePay}
            disabled={saving || !cashBoxId || !date || cargos < -0.01}
          >
            {saving ? "Pagando…" : "Confirmar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cuotas y compras de una tarjeta ─────────────────────────────────────────

const PENDIENTES = "__pendientes__";
const TODAS = "__todas__";
const AGRUPAR = {
  supplier: "Proveedor",
  concept: "Rubro",
  none: "Sin agrupar",
} as const;
type Agrupar = keyof typeof AGRUPAR;
type CuotaConCompra = Cuota & { purchase: Compra };

function DetailDialog({
  card,
  onClose,
}: {
  card: CardRow;
  onClose: () => void;
}) {
  const [datos, setDatos] = useState<{
    installments: Cuota[];
    purchases: Compra[];
  } | null>(null);
  const [resumen, setResumen] = useState(PENDIENTES);
  const [agrupar, setAgrupar] = useState<Agrupar>("supplier");
  const [buscar, setBuscar] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await pedir(`/api/caja/cards/${card.id}`, "GET"));
    } catch (e) {
      setDatos({ installments: [], purchases: [] });
      setError(e instanceof Error ? e.message : "Error");
    }
  }, [card.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cuotas = useMemo<CuotaConCompra[]>(() => {
    if (!datos) return [];
    const compra = new Map(datos.purchases.map((p) => [p.id, p]));
    return datos.installments.flatMap((c) => {
      const purchase = compra.get(c.purchaseId);
      return purchase ? [{ ...c, purchase }] : [];
    });
  }, [datos]);

  const resumenes = useMemo(
    () => [...new Set(cuotas.map((c) => c.period))].sort(),
    [cuotas],
  );

  const grupos = useMemo(() => {
    const texto = buscar.trim().toLowerCase();
    const visibles = cuotas.filter((c) => {
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
    const porClave = new Map<string, CuotaConCompra[]>();
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

  const borrarCompra = async (p: Compra) => {
    if (
      !window.confirm(
        `¿Borrar la compra de ${ARS.format(p.amount)} (${p.concept}) con todas sus cuotas? No se puede deshacer.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await pedir(`/api/caja/card-purchases/${p.id}`, "DELETE");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
    await cargar();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{card.name}</DialogTitle>
        </DialogHeader>
        <ErrorBox error={error} />

        {datos === null ? (
          <div className="flex justify-center py-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="cuotas">
            <TabsList>
              <TabsTrigger value="cuotas">Cuotas por resumen</TabsTrigger>
              <TabsTrigger value="compras">
                Compras ({datos.purchases.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cuotas" className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Resumen</Label>
                  <Select value={resumen} onValueChange={setResumen}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PENDIENTES}>
                        Todo lo pendiente
                      </SelectItem>
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

              {grupos.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  No hay cuotas para mostrar.
                </p>
              ) : (
                <div className="max-h-[45vh] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Compra</TableHead>
                        <TableHead>
                          {agrupar === "concept" ? "Proveedor" : "Rubro"}
                        </TableHead>
                        <TableHead>Qué</TableHead>
                        <TableHead>Cuota</TableHead>
                        <TableHead>Resumen</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupos.map((g) => (
                        <GrupoDeCuotas key={g.clave} {...g} agrupar={agrupar} />
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
            </TabsContent>

            <TabsContent value="compras" className="mt-3">
              {datos.purchases.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">
                  No hay compras con cuotas pendientes o recientes.
                </p>
              ) : (
                <div className="max-h-[55vh] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Qué</TableHead>
                        <TableHead>Rubro</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Cuotas</TableHead>
                        <TableHead>1er resumen</TableHead>
                        <TableHead>Cargó</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {datos.purchases.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="whitespace-nowrap text-xs tabular-nums">
                            {FECHA.format(new Date(p.date))}
                          </TableCell>
                          <TableCell className="max-w-56 truncate text-xs">
                            {p.notes || p.reference || "—"}
                          </TableCell>
                          <TableCell className="text-xs">{p.concept}</TableCell>
                          <TableCell className="text-xs">
                            {p.supplier || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">
                            {ARS.format(p.amount)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs tabular-nums">
                            {p.paidInstallments}/{p.installments} pagadas
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs capitalize">
                            {p.firstPeriod ? nombreResumen(p.firstPeriod) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {p.createdBy ?? "—"}
                          </TableCell>
                          <TableCell className="w-8">
                            {p.paidInstallments === 0 && (
                              <button
                                type="button"
                                title="Borrar la compra con todas sus cuotas"
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                onClick={() => borrarCompra(p)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GrupoDeCuotas({
  clave,
  filas,
  total,
  agrupar,
}: {
  clave: string;
  filas: CuotaConCompra[];
  total: number;
  agrupar: Agrupar;
}) {
  return (
    <>
      {agrupar !== "none" && (
        <TableRow className="bg-slate-50 hover:bg-slate-50">
          <TableCell colSpan={6} className="text-xs font-semibold">
            {clave} · {filas.length} cuota{filas.length === 1 ? "" : "s"}
          </TableCell>
          <TableCell className="text-right text-xs font-semibold tabular-nums">
            {ARS.format(total)}
          </TableCell>
          <TableCell />
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
          <TableCell className="whitespace-nowrap text-xs tabular-nums">
            {VENCE.format(new Date(c.dueDate))}
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
        </TableRow>
      ))}
    </>
  );
}
