"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { MAX_CUOTAS, periodoPrimeraCuota, repartirCuotas } from "@/lib/cuotas";
import type { CashBoxSummary } from "./caja-section";
import { useCashConcepts } from "./use-cash-concepts";

/**
 * spec 4.3 v2 · Dialog para registrar un INGRESO o EGRESO manual en una
 * caja. Los cobros vinculados a facturas NO pasan por acá, se crean desde
 * la ficha del vehículo.
 */

type Props = {
  type: "INGRESO" | "EGRESO";
  cashBoxId: string;
  boxes: CashBoxSummary[];
  onClose: () => void;
  onSaved: () => void;
};

const METHODS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "MERCADOPAGO", label: "Mercado Pago" },
  { value: "OTRO", label: "Otro" },
];

// Los rubros de EGRESO viven en la tabla CashConcept (Configuración → Rubros
// de caja). Cuando el rubro tiene subcategorías, el `concept` guardado queda
// como "<Rubro> · <Sub>" para que el filtro por texto siga funcionando.
const EGRESO_OTHER = "__otro__";

/**
 * Convierte un `YYYY-MM-DD` (del input type="date") a ISO en mediodía local.
 * Si mandamos el string tal cual, el server hace `new Date("2026-07-24")`
 * que lo parsea como UTC 00:00 → en AR sale un día antes.
 */
function localNoonISO(v: string): string {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export default function MovementDialog({
  type,
  cashBoxId,
  boxes,
  onClose,
  onSaved,
}: Props) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("EFECTIVO");
  const [concept, setConcept] = useState("");
  // Para EGRESO usamos un select del catálogo con opción "Otro…" que
  // habilita el input libre. INGRESO usa texto libre directo.
  const [conceptChoice, setConceptChoice] = useState<string>("");
  // spec v2 · Sub-categoría del concepto (ej. Impuestos → "Luz").
  // Solo se muestra si `conceptChoice` tiene subs en EGRESO_SUBCATEGORIES.
  const [conceptSub, setConceptSub] = useState<string>("");
  const concepts = useCashConcepts();
  const subsOf = (label: string) =>
    concepts.find((c) => c.label === label)?.subs ?? [];
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedBoxId, setSelectedBoxId] = useState(cashBoxId);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // spec v2 · "Es un pase" → mueve plata en la caja pero NO cuenta como
  // ingreso/egreso contable del mes. Al guardar mandamos PASE_IN / PASE_OUT
  // en vez de INGRESO / EGRESO.
  const [isPase, setIsPase] = useState(false);

  // spec Tarjetas oct '26 · Un EGRESO con método "Tarjeta" puede ser una
  // compra con tarjeta de crédito: no sale de la caja ahora, genera cuotas y
  // la plata sale al pagar cada resumen (pestaña Tarjetas).
  const [cards, setCards] = useState<
    { id: string; name: string; closingDay: number | null }[]
  >([]);
  const [cardId, setCardId] = useState("");
  const [cuotas, setCuotas] = useState("1");
  // Vacío = el resumen que le toca según el día de cierre de la tarjeta.
  const [primerResumen, setPrimerResumen] = useState("");
  const [supplier, setSupplier] = useState("");
  useEffect(() => {
    if (type !== "EGRESO") return;
    fetch("/api/caja/cards")
      .then((r) => (r.ok ? r.json() : { cards: [] }))
      .then((d) => setCards(d.cards))
      .catch(() => setCards([]));
  }, [type]);

  // spec v2 · Para INGRESO opcional: vincular el cobro a un vehículo por
  // N° interno. Si se vincula y se elige una factura, el ingreso se
  // registra como RepairInvoicePayment (aparece en Caja + en la ficha del
  // vehículo, sección "Facturación y cobros"). Si no, cae en CashMovement
  // como antes (ingreso libre).
  const [internalNumber, setInternalNumber] = useState("");
  const [linkedRepair, setLinkedRepair] = useState<{
    id: string;
    internalNumber: number | null;
    customerName: string;
    vehicleSummary: string;
    vehicleDomain: string;
    status: string;
    invoices: Array<{
      id: string;
      number: string;
      amount: number;
      paid: number;
      remaining: number;
      recipient: string;
      recipientName: string | null;
    }>;
  } | null>(null);
  const [linkingError, setLinkingError] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [lookupBusy, setLookupBusy] = useState(false);
  /**
   * Otras tarjetas con el mismo N° interno. Desde que un cliente puede tener
   * dos siniestros con el mismo número, el lookup puede traer más de una: se
   * imputa a la más activa, pero el operador tiene que verlo antes de cobrar.
   */
  const [duplicates, setDuplicates] = useState<
    Array<{ id: string; customerName: string; vehicleDomain: string }>
  >([]);

  // Búsqueda debounced del N° interno mientras el usuario tipea.
  useEffect(() => {
    if (type !== "INGRESO") return;
    const n = internalNumber.trim();
    if (!n) {
      setLinkedRepair(null);
      setLinkingError(null);
      setSelectedInvoiceId("");
      setDuplicates([]);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(async () => {
      setLookupBusy(true);
      setLinkingError(null);
      try {
        const res = await fetch(
          `/api/repairs/by-internal-number?n=${encodeURIComponent(n)}`,
          { signal: ac.signal },
        );
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          setLinkedRepair(null);
          setSelectedInvoiceId("");
          setDuplicates([]);
          setLinkingError(b?.error ?? `HTTP ${res.status}`);
          return;
        }
        const d = (await res.json()) as {
          repair: typeof linkedRepair;
          duplicates?: Array<{
            id: string;
            customerName: string;
            vehicleDomain: string;
          }>;
        };
        setLinkedRepair(d.repair);
        setDuplicates(d.duplicates ?? []);
        // Autoselecciona la primera factura con saldo pendiente para
        // ahorrarle el click al operador.
        const firstPending =
          d.repair?.invoices.find((i) => i.remaining > 0) ??
          d.repair?.invoices[0] ??
          null;
        setSelectedInvoiceId(firstPending?.id ?? "");
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setLinkingError(e instanceof Error ? e.message : "Error");
        }
      } finally {
        setLookupBusy(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [internalNumber, type]);

  const title = type === "INGRESO" ? "Registrar ingreso" : "Registrar egreso";
  const buttonLabel = type === "INGRESO" ? "Guardar ingreso" : "Guardar egreso";
  // Un pase nunca se puede vincular a factura (no es un cobro real).
  const willLinkToRepair =
    type === "INGRESO" && !isPase && !!linkedRepair && !!selectedInvoiceId;
  // Efectivo tipo enviado al server: PASE_IN / PASE_OUT si es pase.
  const effectiveType = isPase
    ? type === "INGRESO"
      ? "PASE_IN"
      : "PASE_OUT"
    : type;

  const payingWithCard =
    type === "EGRESO" && !isPase && method === "TARJETA" && !!cardId;
  const cuotasNum = Math.min(
    MAX_CUOTAS,
    Math.max(1, Math.trunc(Number(cuotas)) || 1),
  );
  const resumenPorDefecto = periodoPrimeraCuota(
    new Date(`${paidAt}T00:00:00.000Z`),
    cards.find((c) => c.id === cardId)?.closingDay ?? null,
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (payingWithCard) {
        // Compra con tarjeta de crédito → cuotas, sin CashMovement.
        const res = await fetch("/api/caja/card-purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creditCardId: cardId,
            amount: Number(amount),
            concept,
            supplier: supplier.trim() || null,
            notes: notes.trim() || null,
            reference: reference.trim() || null,
            purchasedAt: localNoonISO(paidAt),
            installments: cuotasNum,
            firstPeriod: primerResumen || undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
      } else if (willLinkToRepair) {
        // Cobro vinculado a factura del cliente → aparece en Caja + ficha.
        const res = await fetch(
          `/api/repair-invoices/${selectedInvoiceId}/payments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: Number(amount),
              paidAt: localNoonISO(paidAt),
              method,
              reference: reference.trim() || null,
              notes: notes.trim() || concept.trim() || null,
              cashBoxId: selectedBoxId,
            }),
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
      } else {
        // Ingreso libre → CashMovement como antes.
        const res = await fetch("/api/caja/movements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cashBoxId: selectedBoxId,
            type: effectiveType,
            amount: Number(amount),
            method,
            concept,
            reference: reference.trim() || null,
            notes: notes.trim() || null,
            paidAt: localNoonISO(paidAt),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const canSave =
    Number(amount) > 0 &&
    // Si va vinculado a factura, el "concept" no es obligatorio (usamos el
    // de la factura). Si es INGRESO libre o EGRESO, sí.
    (willLinkToRepair || concept.trim().length > 0) &&
    selectedBoxId &&
    !saving;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Caja</Label>
            <Select value={selectedBoxId} onValueChange={setSelectedBoxId}>
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

          {/* spec v2 · Toggle "es un pase" — el movimiento cuenta para el
              saldo de la caja pero no como ingreso/egreso del mes. Útil para
              retiros temporales o entregas de plata entre personas. */}
          <label
            className={`flex items-start gap-2 cursor-pointer rounded-md border p-2 ${
              isPase
                ? "border-violet-300 bg-violet-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              checked={isPase}
              onChange={(e) => setIsPase(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <div className="grid gap-0.5">
              <span className="text-sm font-medium text-slate-800">
                {type === "INGRESO"
                  ? "Es un pase (dinero que entra por pase)"
                  : "Es un retiro / pase (no es un gasto real)"}
              </span>
              <span className="text-[11px] text-slate-500">
                Cuenta para el saldo de la caja pero no suma como{" "}
                {type === "INGRESO" ? "ingreso" : "egreso"} del mes.
              </span>
            </div>
          </label>

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

          {/* spec Tarjetas oct '26 · Compra con tarjeta de crédito en cuotas. */}
          {type === "EGRESO" &&
            !isPase &&
            method === "TARJETA" &&
            cards.length > 0 && (
              <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <div className="grid gap-1">
                  <Label className="text-xs">Tarjeta de crédito</Label>
                  <Select
                    value={cardId || "__ninguna__"}
                    onValueChange={(v) =>
                      setCardId(v === "__ninguna__" ? "" : v)
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ninguna__">
                        No: sale de la caja ahora
                      </SelectItem>
                      {cards.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {payingWithCard && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1">
                        <Label className="text-xs">Cuotas</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={MAX_CUOTAS}
                          className="bg-white"
                          value={cuotas}
                          onChange={(e) => setCuotas(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">Primer resumen</Label>
                        <Input
                          type="month"
                          className="bg-white"
                          value={primerResumen || resumenPorDefecto}
                          onChange={(e) => setPrimerResumen(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Proveedor</Label>
                      <Input
                        className="bg-white"
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        placeholder="A quién se le compró"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {cuotasNum > 1 && Number(amount) > 0
                        ? `${cuotasNum} cuotas de ${repartirCuotas(Number(amount), cuotasNum)[0].toLocaleString("es-AR", { style: "currency", currency: "ARS" })}, una por resumen. `
                        : ""}
                      No sale de ninguna caja ahora: sale al pagar cada resumen
                      en la pestaña Tarjetas.
                    </p>
                  </>
                )}
              </div>
            )}

          {/* spec v2 · Vinculador con vehículo por N° interno (solo INGRESO).
              Si el ingreso corresponde al cobro de un cliente, se guarda como
              RepairInvoicePayment y aparece también en "Facturación y cobros"
              de la ficha del vehículo. */}
          {type === "INGRESO" && (
            <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-2.5">
              <Label className="text-xs">
                N° interno del vehículo (opcional)
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Ej: 4029 — vincula el cobro al cliente"
                value={internalNumber}
                onChange={(e) => setInternalNumber(e.target.value)}
              />
              {lookupBusy && (
                <p className="text-[11px] text-slate-500">Buscando…</p>
              )}
              {linkingError && (
                <p className="text-[11px] text-rose-700">{linkingError}</p>
              )}
              {linkedRepair && (
                <div className="mt-1 space-y-1">
                  <p className="text-[11px] text-slate-700">
                    <span className="font-medium">
                      {linkedRepair.customerName}
                    </span>{" "}
                    · {linkedRepair.vehicleSummary} ·{" "}
                    {linkedRepair.vehicleDomain}
                  </p>
                  {duplicates.length > 0 && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      Hay {duplicates.length + 1} vehículos con el Nº{" "}
                      {internalNumber.trim()}. Se está imputando al de arriba;
                      los otros son{" "}
                      {duplicates
                        .map((d) => `${d.customerName} (${d.vehicleDomain})`)
                        .join(", ")}
                      .
                    </p>
                  )}
                  {linkedRepair.invoices.length === 0 ? (
                    <p className="text-[11px] text-amber-700">
                      Este vehículo todavía no tiene facturas cargadas. El
                      ingreso se guardará como movimiento libre — para impactar
                      en "Facturación y cobros" primero creá la factura desde la
                      ficha del vehículo.
                    </p>
                  ) : (
                    <div className="grid gap-1">
                      <Label className="text-[10px]">Factura a imputar</Label>
                      <Select
                        value={selectedInvoiceId}
                        onValueChange={setSelectedInvoiceId}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Elegí la factura" />
                        </SelectTrigger>
                        <SelectContent>
                          {linkedRepair.invoices.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>
                              #{inv.number} — total $
                              {inv.amount.toLocaleString("es-AR")} · saldo $
                              {inv.remaining.toLocaleString("es-AR")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {type === "EGRESO" ? (
            <div className="grid gap-1">
              <Label className="text-xs">Concepto</Label>
              <Select
                value={conceptChoice}
                onValueChange={(v) => {
                  setConceptChoice(v);
                  setConceptSub("");
                  if (v === EGRESO_OTHER) {
                    // Vacío, para que escriban.
                    setConcept("");
                  } else if (subsOf(v).length > 0) {
                    // Va a pedir sub — dejamos el concept vacío hasta que
                    // se elija la subcategoría.
                    setConcept("");
                  } else {
                    // Preset sin subs → ese texto es el concepto final.
                    setConcept(v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegí el rubro del egreso" />
                </SelectTrigger>
                <SelectContent>
                  {concepts.map((c) => (
                    <SelectItem key={c.label} value={c.label}>
                      {c.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={EGRESO_OTHER}>Otro…</SelectItem>
                </SelectContent>
              </Select>
              {subsOf(conceptChoice).length > 0 && (
                <div className="mt-1 grid gap-1">
                  <Label className="text-[10px] text-slate-500">
                    Subcategoría de {conceptChoice}
                  </Label>
                  <Select
                    value={conceptSub}
                    onValueChange={(v) => {
                      setConceptSub(v);
                      // Concept final: "Impuestos · Luz" — así el filtro por
                      // texto sigue funcionando en el listado de caja.
                      setConcept(`${conceptChoice} · ${v}`);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Elegí la subcategoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {subsOf(conceptChoice).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {conceptChoice === EGRESO_OTHER && (
                <Input
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Detalle del egreso"
                  className="mt-1"
                />
              )}
            </div>
          ) : (
            <div className="grid gap-1">
              <Label className="text-xs">Concepto</Label>
              <Input
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Ej: aporte, venta, ajuste…"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Fecha</Label>
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Referencia</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Nº comprobante"
              />
            </div>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Notas</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle opcional"
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
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
