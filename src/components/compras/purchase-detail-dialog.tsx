"use client";

/**
 * Vista de detalle (OJO) — spec Compras v2.
 *
 * Muestra toda la info de una compra: fechas, cotización elegida y las
 * descartadas, notas. Permite editar campos y cambiar el status (incluye
 * retroceder — el brief lo requiere para devoluciones).
 *
 * También dispara el flujo de "marcar como pagado" (repuesto y/o flete) —
 * abre un sub-dialog que pide la caja y el método.
 */

import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Package,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PURCHASE_STATUS_META,
  PURCHASE_STATUSES_IN_ORDER,
} from "@/lib/purchases/catalog";
import type { CashBoxLite, PurchaseRow, SupplierLite } from "./types";

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

/** `YYYY-MM-DD` (input date) → ISO al mediodía LOCAL. */
function localNoonISO(v: string): string {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

/** ISO → `YYYY-MM-DD` LOCAL para prefill de input date. */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type DetailPurchase = PurchaseRow & {
  item: PurchaseRow["item"] & {
    quotes: Array<{
      id: string;
      category: "OFICIAL" | "ALTERNATIVO" | "DESARMADERO";
      supplierName: string;
      supplier: { id: string; name: string } | null;
      price: string | number;
      discount: string | number | null;
      partCode: string | null;
      availability: string | null;
      notes: string | null;
    }>;
  };
};

export default function PurchaseDetailDialog({
  purchaseId,
  suppliers,
  cashBoxes,
  onClose,
  onChanged,
  onSuppliersChanged,
}: {
  purchaseId: string;
  suppliers: SupplierLite[];
  cashBoxes: CashBoxLite[];
  onClose: () => void;
  onChanged: () => void;
  /** Notifica al padre que se creó un proveedor nuevo (para refetchear). */
  onSuppliersChanged?: () => void;
}) {
  // Suppliers locales — arrancan de la prop y se pueden extender inline al
  // crear un proveedor nuevo desde el modal. Se sincronizan cuando la prop
  // cambia (padre refetchea después de crear).
  const [localSuppliers, setLocalSuppliers] = useState<SupplierLite[]>(suppliers);
  useEffect(() => {
    setLocalSuppliers(suppliers);
  }, [suppliers]);
  const [purchase, setPurchase] = useState<DetailPurchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form editable
  const [supplierId, setSupplierId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [freightSupplierId, setFreightSupplierId] = useState<string>("");
  const [freightAmount, setFreightAmount] = useState<string>("");
  const [purchasedAt, setPurchasedAt] = useState<string>("");
  const [receivedAt, setReceivedAt] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [payDialogOpen, setPayDialogOpen] = useState<{
    which: "parts" | "freight" | "both";
  } | null>(null);

  const fetchPurchase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as { purchase: DetailPurchase };
      setPurchase(d.purchase);
      setSupplierId(d.purchase.supplierId ?? "");
      setAmount(String(d.purchase.amount ?? ""));
      setFreightSupplierId(d.purchase.freightSupplierId ?? "");
      setFreightAmount(String(d.purchase.freightAmount ?? ""));
      setPurchasedAt(toDateInput(d.purchase.purchasedAt));
      setReceivedAt(toDateInput(d.purchase.receivedAt));
      setNotes(d.purchase.notes ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    fetchPurchase();
  }, [fetchPurchase]);

  const patch = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      await fetchPurchase();
      onChanged();
    } catch (e) {
      window.alert(
        e instanceof Error ? `No se pudo guardar: ${e.message}` : "Error",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveEditable = () =>
    patch({
      supplierId: supplierId || null,
      amount: Number(amount) || 0,
      freightSupplierId: freightSupplierId || null,
      freightAmount: Number(freightAmount) || 0,
      purchasedAt: purchasedAt ? localNoonISO(purchasedAt) : null,
      receivedAt: receivedAt ? localNoonISO(receivedAt) : null,
      notes: notes.trim() || null,
    });

  const changeStatus = (next: string) => patch({ status: next });

  const chooseQuote = (quoteId: string) =>
    patch({ chosenQuoteId: quoteId, status: "COMPRAR" });

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalle de la compra
              {purchase && (
                <span className="text-xs font-mono text-slate-500">
                  {purchase.number}
                </span>
              )}
            </DialogTitle>
            {purchase && (
              <DialogDescription>
                {purchase.item.description}
                {purchase.item.budget?.repair && (
                  <>
                    {" · "}
                    <Link
                      href={`/produccion?repairId=${purchase.item.budget.repair.id}`}
                      className="text-[#003b73] hover:underline"
                    >
                      {purchase.item.budget.repair.customerName} ·{" "}
                      {purchase.item.budget.repair.vehicleBrand}{" "}
                      {purchase.item.budget.repair.vehicleModel} ·{" "}
                      {purchase.item.budget.repair.vehicleDomain}
                    </Link>
                  </>
                )}
              </DialogDescription>
            )}
          </DialogHeader>

          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">
              <Loader2 className="h-4 w-4 inline animate-spin mr-2" />
              Cargando…
            </div>
          ) : error ? (
            <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded">
              {error}
            </div>
          ) : purchase ? (
            <div className="space-y-4">
              {/* Máquina de estados como botones */}
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Estado (podés retroceder)
                </Label>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {PURCHASE_STATUSES_IN_ORDER.map((s) => {
                    const meta = PURCHASE_STATUS_META[s];
                    const active = s === purchase.status;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => changeStatus(s)}
                        disabled={active || saving}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition ${
                          active
                            ? `${meta.tone.bg} ${meta.tone.text} border-transparent font-semibold`
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 disabled:opacity-50"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${meta.tone.dot}`}
                        />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cotizaciones (elegida + descartadas) */}
              <div className="rounded-md border border-slate-200 bg-white">
                <div className="px-3 py-2 border-b bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Cotizaciones del ítem
                </div>
                {purchase.item.quotes.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 italic">
                    Sin cotizaciones cargadas todavía. Cargálas desde el ítem
                    en la ficha administrativa.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {purchase.item.quotes.map((q) => {
                      const chosen = purchase.chosenQuote?.id === q.id;
                      const price = Number(q.price);
                      const discount = Number(q.discount ?? 0);
                      const net = price * (1 - discount / 100);
                      return (
                        <li
                          key={q.id}
                          className={`px-3 py-2 flex items-center gap-3 text-sm ${
                            chosen ? "bg-emerald-50" : ""
                          }`}
                        >
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold bg-slate-100 text-slate-700">
                            {q.category}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">
                              {q.supplier?.name ?? q.supplierName}
                              {q.partCode && (
                                <span className="ml-2 text-[10px] font-mono text-slate-400">
                                  #{q.partCode}
                                </span>
                              )}
                            </div>
                            {q.availability && (
                              <div className="text-[11px] text-slate-500">
                                {q.availability}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold tabular-nums">
                              {ARS.format(net)}
                            </div>
                            {discount > 0 && (
                              <div className="text-[10px] text-slate-400 line-through tabular-nums">
                                {ARS.format(price)}
                              </div>
                            )}
                          </div>
                          {chosen ? (
                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500 text-white font-semibold">
                              Elegida ✓
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => chooseQuote(q.id)}
                              disabled={saving}
                              className="h-7 text-xs"
                            >
                              Elegir
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Form editable — proveedor / amount / flete / fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs">Proveedor del repuesto</Label>
                  <SupplierPicker
                    value={supplierId}
                    onChange={setSupplierId}
                    suppliers={localSuppliers}
                    onCreated={(s) => {
                      setLocalSuppliers((prev) =>
                        prev.some((p) => p.id === s.id) ? prev : [...prev, s],
                      );
                      onSuppliersChanged?.();
                    }}
                    disabled={saving}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Monto del repuesto</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Proveedor del flete</Label>
                  <SupplierPicker
                    value={freightSupplierId}
                    onChange={setFreightSupplierId}
                    suppliers={localSuppliers}
                    onCreated={(s) => {
                      setLocalSuppliers((prev) =>
                        prev.some((p) => p.id === s.id) ? prev : [...prev, s],
                      );
                      onSuppliersChanged?.();
                    }}
                    disabled={saving}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Monto del flete</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={freightAmount}
                    onChange={(e) => setFreightAmount(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Fecha de compra</Label>
                  <Input
                    type="date"
                    value={purchasedAt}
                    onChange={(e) => setPurchasedAt(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">
                    Fecha de recepción
                    <span className="ml-1 text-[10px] text-slate-500 font-normal">
                      · sincroniza con Producción
                    </span>
                  </Label>
                  <Input
                    type="date"
                    value={receivedAt}
                    onChange={(e) => setReceivedAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Notas</Label>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Aclaraciones — condiciones, comprobante, incidencias con la compra…"
                />
              </div>

              {/* Estado de pago */}
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Estado de pago
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-slate-500" />
                      <span className="text-xs text-slate-600">Repuesto</span>
                    </div>
                    {purchase.paidPartsAt ? (
                      <div className="mt-1">
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                          ✓ Pagado {DATE_FMT.format(new Date(purchase.paidPartsAt))}
                        </span>
                      </div>
                    ) : Number(purchase.amount) > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1 h-8 gap-1.5"
                        onClick={() => setPayDialogOpen({ which: "parts" })}
                        disabled={saving}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Marcar pagado
                      </Button>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic mt-1">
                        Sin monto
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-slate-500" />
                      <span className="text-xs text-slate-600">Flete</span>
                    </div>
                    {purchase.paidFreightAt ? (
                      <div className="mt-1">
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                          ✓ Pagado{" "}
                          {DATE_FMT.format(new Date(purchase.paidFreightAt))}
                        </span>
                      </div>
                    ) : Number(purchase.freightAmount) > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1 h-8 gap-1.5"
                        onClick={() => setPayDialogOpen({ which: "freight" })}
                        disabled={saving}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Marcar pagado
                      </Button>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic mt-1">
                        Sin flete
                      </div>
                    )}
                  </div>
                </div>
                {Number(purchase.amount) > 0 &&
                  Number(purchase.freightAmount) > 0 &&
                  !purchase.paidPartsAt &&
                  !purchase.paidFreightAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 gap-1.5"
                      onClick={() => setPayDialogOpen({ which: "both" })}
                      disabled={saving}
                    >
                      Pagar ambos
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cerrar
            </Button>
            {purchase && (
              <Button onClick={saveEditable} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar cambios
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {payDialogOpen && purchase && (
        <PayDialog
          purchase={purchase}
          which={payDialogOpen.which}
          cashBoxes={cashBoxes}
          onClose={() => setPayDialogOpen(null)}
          onPaid={() => {
            setPayDialogOpen(null);
            fetchPurchase();
            onChanged();
          }}
        />
      )}
    </>
  );
}

function PayDialog({
  purchase,
  which,
  cashBoxes,
  onClose,
  onPaid,
}: {
  purchase: DetailPurchase;
  which: "parts" | "freight" | "both";
  cashBoxes: CashBoxLite[];
  onClose: () => void;
  onPaid: () => void;
}) {
  const [cashBoxId, setCashBoxId] = useState(cashBoxes[0]?.id ?? "");
  const [method, setMethod] = useState("EFECTIVO");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total =
    (which === "parts" || which === "both" ? Number(purchase.amount) : 0) +
    (which === "freight" || which === "both"
      ? Number(purchase.freightAmount)
      : 0);

  const handlePay = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchases/${purchase.id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ which, cashBoxId, method }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      onPaid();
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
          <DialogTitle>
            Registrar pago —{" "}
            {which === "parts"
              ? "Repuesto"
              : which === "freight"
                ? "Flete"
                : "Repuesto + Flete"}
          </DialogTitle>
          <DialogDescription>
            Se va a crear un EGRESO en la caja seleccionada por{" "}
            {ARS.format(total)}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Caja</Label>
            <Select value={cashBoxId} onValueChange={setCashBoxId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí la caja" />
              </SelectTrigger>
              <SelectContent>
                {cashBoxes.map((b) => (
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
                <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                <SelectItem value="CHEQUE">Cheque</SelectItem>
                <SelectItem value="TARJETA">Tarjeta</SelectItem>
                <SelectItem value="MERCADOPAGO">Mercado Pago</SelectItem>
                <SelectItem value="OTRO">Otro</SelectItem>
              </SelectContent>
            </Select>
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
          <Button onClick={handlePay} disabled={saving || !cashBoxId}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-componente: SupplierPicker ────────────────────────────────────────
// Select del maestro de proveedores + toggle para crear uno nuevo inline.
// Al crear, POST /api/suppliers, notifica al padre (para refetchear la lista
// global) y auto-selecciona el nuevo. Si el nombre ya existe (409), se
// muestra el error; el usuario puede reintentar o elegir del select.
function SupplierPicker({
  value,
  onChange,
  suppliers,
  onCreated,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  suppliers: SupplierLite[];
  onCreated: (s: SupplierLite) => void;
  disabled?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cancel = () => {
    setCreating(false);
    setNewName("");
    setErr(null);
  };

  const submit = async () => {
    const name = newName.trim();
    if (!name) {
      setErr("Ingresá un nombre");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.status === 409) {
        // Duplicado: intentamos encontrarlo por nombre en la lista actual y
        // auto-seleccionar. Si no está, avisamos.
        const existing = suppliers.find(
          (s) => s.name.toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
          onChange(existing.id);
          cancel();
          return;
        }
        setErr("Ya existe un proveedor con ese nombre.");
        return;
      }
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b?.error ?? `Error HTTP ${res.status}`);
        return;
      }
      const d = (await res.json()) as {
        supplier: { id: string; name: string; isActive: boolean };
      };
      onCreated({
        id: d.supplier.id,
        name: d.supplier.name,
        isActive: d.supplier.isActive,
      });
      onChange(d.supplier.id);
      cancel();
    } finally {
      setSaving(false);
    }
  };

  if (creating) {
    return (
      <div className="space-y-1">
        <div className="flex gap-1">
          <Input
            autoFocus
            className="h-9"
            placeholder="Nombre del proveedor"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") cancel();
            }}
            disabled={saving}
          />
          <Button
            size="sm"
            className="h-9"
            onClick={submit}
            disabled={saving || !newName.trim()}
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Guardar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9"
            onClick={cancel}
            disabled={saving}
          >
            Cancelar
          </Button>
        </div>
        {err && <div className="text-[11px] text-rose-600">{err}</div>}
      </div>
    );
  }

  return (
    <div className="flex gap-1">
      <Select
        value={value || "__none__"}
        onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 flex-1">
          <SelectValue placeholder="Sin definir" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Sin definir</SelectItem>
          {suppliers.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        className="h-9 px-2 text-[11px]"
        onClick={() => setCreating(true)}
        disabled={disabled}
        title="Crear un proveedor nuevo y registrarlo en el maestro"
      >
        + Nuevo
      </Button>
    </div>
  );
}
