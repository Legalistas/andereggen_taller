"use client";

/**
 * Modal "Administrativa" del presupuesto.
 *
 * Dos hojas:
 *   - Cotizaciones: grilla comparativa con 3 columnas (Oficial / Alternativo /
 *     Desarmadero). Una fila por repuesto a reemplazar; cada celda lista las
 *     cotizaciones cargadas para esa categoría. Permite escanear de un golpe
 *     "cuánto cuesta X en cada bucket" sin scrollear cada item.
 *   - Compras: tabla con las compras efectivamente realizadas. Permite
 *     registrar compras para repuestos que no fueron cotizados.
 *
 * IMPORTANTE: toda la información de este modal es de uso interno —
 * NUNCA aparece en el PDF que se le envía al cliente.
 */

import {
  Camera,
  Check,
  ClipboardList,
  Eye,
  Loader2,
  Lock,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import PurchaseDetailDialog from "@/components/compras/purchase-detail-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

type QuoteCategory = "OFICIAL" | "ALTERNATIVO" | "DESARMADERO";

type Quote = {
  id: string;
  category: QuoteCategory;
  supplierName: string;
  price: string | number;
  partCode: string | null;
  discount: string | number | null;
  availability: string | null;
  photos: string[];
  notes: string | null;
};

/** Precio neto = price * (1 - discount/100). Sin descuento ⇒ price. */
function netPrice(q: Pick<Quote, "price" | "discount">): number {
  const p = Number(q.price);
  const d =
    q.discount === null || q.discount === undefined ? 0 : Number(q.discount);
  if (!Number.isFinite(p)) return 0;
  if (!Number.isFinite(d) || d <= 0) return p;
  return p * (1 - d / 100);
}

// spec Compras v2 · shape que devuelve /api/budgets/[id]/admin — items[].purchases (plural).
// Un mismo ítem puede tener N compras (devoluciones, recompras, etc.).
type PurchaseSummary = {
  id: string;
  number: string;
  status:
    | "COTIZAR"
    | "DECIDIR"
    | "COMPRAR"
    | "EN_CAMINO"
    | "EN_TALLER"
    | "PENDIENTE_PAGO"
    | "ARCHIVADA";
  category: QuoteCategory | null;
  supplierName: string | null;
  amount: string | number;
  freightAmount: string | number;
  freightSupplierName: string | null;
  purchasedAt: string | null;
  receivedAt: string | null;
  paidPartsAt: string | null;
  paidFreightAt: string | null;
  notes: string | null;
};

type Item = {
  id: string;
  order: number;
  description: string;
  notes: string | null;
  photos: string[];
  quotes: Quote[];
  purchases: PurchaseSummary[];
};

type Props = {
  budgetId: string | null;
  budgetNumber?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMinimizedChange?: (minimized: boolean) => void;
};

const CATEGORIES: Array<{
  key: QuoteCategory;
  label: string;
  short: string;
  headerClass: string;
  tintClass: string;
}> = [
  {
    key: "OFICIAL",
    label: "Oficial / Concesionaria",
    short: "Oficial",
    headerClass: "bg-blue-50 text-blue-800 border-blue-200",
    tintClass: "border-blue-100",
  },
  {
    key: "ALTERNATIVO",
    label: "Alternativo",
    short: "Alternativo",
    headerClass: "bg-amber-50 text-amber-800 border-amber-200",
    tintClass: "border-amber-100",
  },
  {
    key: "DESARMADERO",
    label: "Desarmadero",
    short: "Desarmadero",
    headerClass: "bg-purple-50 text-purple-800 border-purple-200",
    tintClass: "border-purple-100",
  },
];

export function BudgetAdminDialog({
  budgetId,
  budgetNumber,
  open,
  onOpenChange,
  onMinimizedChange,
}: Props) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newItemDescription, setNewItemDescription] = useState("");
  const [tab, setTab] = useState<"cotizaciones" | "compras">("cotizaciones");
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    onMinimizedChange?.(minimized);
  }, [minimized, onMinimizedChange]);

  useEffect(() => {
    if (!open) setMinimized(false);
  }, [open]);

  const minimize = () => setMinimized(true);
  const restore = () => setMinimized(false);

  const refresh = useCallback(async () => {
    if (!budgetId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/budgets/${budgetId}/admin`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: Item[] };
      setItems(data.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, [budgetId]);

  useEffect(() => {
    if (!open || !budgetId) return;
    refresh();
  }, [open, budgetId, refresh]);

  // spec Compras v2 · "Efectiva" = cualquier compra que dejó COTIZAR/DECIDIR
  // (ya tiene proveedor y monto — está gestionándose). Sumamos repuesto + flete.
  const totalSpent = (items ?? []).reduce((sum, it) => {
    return (
      sum +
      it.purchases.reduce((s, p) => {
        if (p.status === "COTIZAR" || p.status === "DECIDIR") return s;
        return s + Number(p.amount) + Number(p.freightAmount);
      }, 0)
    );
  }, 0);

  // "Estimado pendiente" — items sin compra efectiva todavía: la cotización
  // más baja como aproximación de lo que queda por gastar.
  const totalQuoted = (items ?? []).reduce((sum, it) => {
    const hasEffective = it.purchases.some(
      (p) => p.status !== "COTIZAR" && p.status !== "DECIDIR",
    );
    if (hasEffective) return sum;
    if (it.quotes.length === 0) return sum;
    const min = Math.min(...it.quotes.map((q) => netPrice(q)));
    return sum + min;
  }, 0);

  const addItem = async () => {
    if (!budgetId) return;
    const desc = newItemDescription.trim();
    if (!desc) return;
    try {
      const res = await fetch(`/api/budgets/${budgetId}/admin/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setNewItemDescription("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear item");
    }
  };

  return (
    <>
      {!minimized && (
        <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
          <DialogContent
            showCloseButton={false}
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            className="max-w-none sm:max-w-none w-screen h-screen p-0 gap-0 flex flex-col rounded-none border-0 overflow-hidden z-60"
          >
            <DialogTitle className="sr-only">
              Administrativa del presupuesto{" "}
              {budgetNumber ? `#${budgetNumber}` : ""}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Información interna: cotizaciones de proveedores y compras
              realizadas.
            </DialogDescription>

            <header className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold leading-tight flex items-center gap-2">
                    Administrativa
                    {budgetNumber !== undefined && (
                      <span className="text-base font-medium text-slate-500">
                        #{budgetNumber}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Lock className="h-3 w-3" />
                    Información interna del taller — no aparece en el PDF al
                    cliente
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={minimize}
                  aria-label="Minimizar"
                  title="Minimizar (libera la pantalla para ver el lead u otros modales)"
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => onOpenChange(false)}
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-muted/20">
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Items registrados
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {items?.length ?? "—"}
                  </div>
                </Card>
                <Card className="p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Total comprado
                  </div>
                  <div className="text-2xl font-bold mt-1 text-emerald-700">
                    {ARS.format(totalSpent)}
                  </div>
                </Card>
                <Card className="p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Estimado pendiente
                  </div>
                  <div className="text-2xl font-bold mt-1 text-slate-600">
                    {ARS.format(totalQuoted)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Suma de la cotización más baja por item sin compra
                  </div>
                </Card>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 border-b border-slate-200">
                <TabButton
                  active={tab === "cotizaciones"}
                  onClick={() => setTab("cotizaciones")}
                >
                  Cotizaciones
                </TabButton>
                <TabButton
                  active={tab === "compras"}
                  onClick={() => setTab("compras")}
                >
                  Compras
                  {(() => {
                    const total = (items ?? []).reduce(
                      (n, it) => n + it.purchases.length,
                      0,
                    );
                    return total > 0 ? (
                      <span className="ml-1.5 text-[10px] bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">
                        {total}
                      </span>
                    ) : null;
                  })()}
                </TabButton>
              </div>

              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              {loading && items === null && (
                <div className="text-center py-12 text-sm text-muted-foreground italic">
                  Cargando…
                </div>
              )}

              {items && tab === "cotizaciones" && (
                <CotizacionesTab
                  items={items}
                  onChanged={refresh}
                  newItemDescription={newItemDescription}
                  setNewItemDescription={setNewItemDescription}
                  addItem={addItem}
                />
              )}

              {items && tab === "compras" && (
                <ComprasTab items={items} onChanged={refresh} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Barra flotante cuando está minimizado */}
      {open && minimized && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 shadow-lg">
          <ClipboardList className="h-4 w-4 text-amber-600 shrink-0" />
          <button
            type="button"
            onClick={restore}
            className="text-sm font-medium text-slate-800 hover:text-amber-700 transition-colors"
            title="Restaurar"
          >
            Administrativa
            {budgetNumber !== undefined && (
              <span className="text-xs text-slate-500 ml-1.5">
                · #{budgetNumber}
              </span>
            )}
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={restore}
            aria-label="Restaurar"
            title="Restaurar"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive"
            onClick={() => {
              setMinimized(false);
              onOpenChange(false);
            }}
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-amber-500 text-amber-700"
          : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab: Cotizaciones — grilla comparativa
// ─────────────────────────────────────────────────────────────────────────

function CotizacionesTab({
  items,
  onChanged,
  newItemDescription,
  setNewItemDescription,
  addItem,
}: {
  items: Item[];
  onChanged: () => void;
  newItemDescription: string;
  setNewItemDescription: (v: string) => void;
  addItem: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Agregar nuevo repuesto */}
      <Card className="p-3 border-dashed bg-white">
        <Label className="text-xs text-muted-foreground">
          Agregar repuesto a reemplazar
        </Label>
        <div className="flex gap-2 mt-1.5">
          <Input
            placeholder="Descripción del repuesto (ej: paragolpes delantero)"
            value={newItemDescription}
            onChange={(e) => setNewItemDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            className="flex-1"
          />
          <Button
            onClick={addItem}
            disabled={!newItemDescription.trim()}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            Todavía no agregaste repuestos para esta administrativa.
          </p>
        </Card>
      ) : (
        <div className="rounded-md border bg-white overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th
                  className="border-b border-r border-slate-200 px-2.5 py-2 text-left font-semibold text-slate-700 min-w-55 w-[18%]"
                  rowSpan={1}
                >
                  Repuesto a reemplazar
                </th>
                {CATEGORIES.map((c) => (
                  <th
                    key={c.key}
                    className={`border-b border-r border-slate-200 px-2 py-2 text-center font-semibold ${c.headerClass}`}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="border-b border-slate-200 px-1 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ItemRow key={item.id} item={item} onChanged={onChanged} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, onChanged }: { item: Item; onChanged: () => void }) {
  // Mínimo neto entre TODAS las cotizaciones del item (cualquier categoría)
  const minNetGlobal =
    item.quotes.length > 0
      ? Math.min(...item.quotes.map((q) => netPrice(q)))
      : null;

  const deleteItem = async () => {
    if (!confirm(`¿Eliminar "${item.description}" y sus cotizaciones?`)) return;
    const res = await fetch(`/api/budget-admin-items/${item.id}`, {
      method: "DELETE",
    });
    if (res.ok) onChanged();
  };

  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="border-r border-slate-200 px-2.5 py-2 align-top">
        <ItemDescription item={item} onChanged={onChanged} />
      </td>
      {CATEGORIES.map((c) => (
        <td
          key={c.key}
          className={`border-r border-slate-200 px-1.5 py-1.5 align-top min-w-70 ${c.tintClass}`}
        >
          <CategoryCell
            item={item}
            category={c.key}
            minNetGlobal={minNetGlobal}
            onChanged={onChanged}
          />
        </td>
      ))}
      <td className="px-1 py-2 text-center align-top">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive"
          onClick={deleteItem}
          aria-label="Eliminar item"
          title="Eliminar item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function ItemDescription({
  item,
  onChanged,
}: {
  item: Item;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.description);

  useEffect(() => {
    setDraft(item.description);
  }, [item.description]);

  const save = async () => {
    const v = draft.trim();
    if (!v) return;
    const res = await fetch(`/api/budget-admin-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: v }),
    });
    if (res.ok) {
      setEditing(false);
      onChanged();
    }
  };

  if (editing) {
    return (
      <div className="flex gap-1">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(item.description);
              setEditing(false);
            }
          }}
          className="h-7 text-xs"
          autoFocus
        />
        <Button
          size="sm"
          className="h-7 w-7 p-0"
          onClick={save}
          aria-label="Guardar"
        >
          <Check className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-left w-full"
      title="Click para editar"
    >
      <div className="font-medium text-slate-800 text-[13px] leading-tight">
        {item.description}
      </div>
      {item.notes ? (
        <div className="text-[10px] text-slate-500 mt-0.5 whitespace-pre-wrap">
          {item.notes}
        </div>
      ) : null}
      {item.photos.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-1">
          {item.photos.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[9px] text-blue-600 hover:underline bg-blue-50 px-1 py-0.5 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <Camera className="h-2 w-2" />
              foto
            </a>
          ))}
        </div>
      ) : null}
    </button>
  );
}

function CategoryCell({
  item,
  category,
  minNetGlobal,
  onChanged,
}: {
  item: Item;
  category: QuoteCategory;
  minNetGlobal: number | null;
  onChanged: () => void;
}) {
  const quotes = item.quotes.filter((q) => q.category === category);

  return (
    <div className="space-y-1">
      {quotes.map((q) => (
        <QuoteLine
          key={q.id}
          quote={q}
          isMin={minNetGlobal !== null && netPrice(q) === minNetGlobal}
          onChanged={onChanged}
        />
      ))}
      <QuickAddQuote
        itemId={item.id}
        category={category}
        onChanged={onChanged}
      />
    </div>
  );
}

function QuoteLine({
  quote,
  isMin,
  onChanged,
}: {
  quote: Quote;
  isMin: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);

  const deleteQuote = async () => {
    if (!confirm("¿Eliminar esta cotización?")) return;
    const res = await fetch(`/api/budget-admin-quotes/${quote.id}`, {
      method: "DELETE",
    });
    if (res.ok) onChanged();
  };

  if (editing) {
    return (
      <QuoteInlineForm
        initial={quote}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const net = netPrice(quote);
  const hasDiscount =
    quote.discount !== null &&
    quote.discount !== undefined &&
    Number(quote.discount) > 0;

  return (
    <div
      className={`group flex items-start gap-1 px-1.5 py-1 rounded ${
        isMin
          ? "bg-emerald-50 border border-emerald-300"
          : "bg-white border border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-[11px] text-slate-800 truncate">
            {quote.supplierName}
          </span>
          {quote.partCode ? (
            <span className="font-mono text-[9px] text-slate-600 bg-slate-50 border border-slate-200 px-1 py-px rounded">
              {quote.partCode}
            </span>
          ) : null}
          {quote.availability ? (
            <span className="text-[9px] text-slate-700 bg-slate-50 border border-slate-200 px-1 py-px rounded">
              {quote.availability}
            </span>
          ) : null}
          {isMin ? (
            <span className="text-[8px] uppercase font-bold text-emerald-700">
              ★ mejor
            </span>
          ) : null}
        </div>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          {hasDiscount ? (
            <>
              <span className="text-[9px] text-slate-400 line-through font-mono">
                {ARS.format(Number(quote.price))}
              </span>
              <span className="text-[9px] text-amber-700 font-semibold">
                -{Number(quote.discount)}%
              </span>
              <span
                className={`font-mono text-[11px] ${
                  isMin
                    ? "text-emerald-700 font-bold"
                    : "text-slate-800 font-semibold"
                }`}
              >
                {ARS.format(net)}
              </span>
            </>
          ) : (
            <span
              className={`font-mono text-[11px] ${
                isMin
                  ? "text-emerald-700 font-bold"
                  : "text-slate-700 font-semibold"
              }`}
            >
              {ARS.format(net)}
            </span>
          )}
        </div>
        {quote.notes ? (
          <div className="text-[9px] text-slate-500 italic mt-0.5 line-clamp-2">
            {quote.notes}
          </div>
        ) : null}
        {quote.photos.length > 0 ? (
          <div className="flex flex-wrap gap-0.5 mt-0.5">
            {quote.photos.slice(0, 3).map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[9px] text-blue-600 hover:underline bg-blue-50 px-1 py-px rounded"
              >
                <Camera className="h-2 w-2" />
                foto
              </a>
            ))}
            {quote.photos.length > 3 ? (
              <span className="text-[9px] text-slate-400">
                +{quote.photos.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col items-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="h-4 w-4 inline-flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
          title="Editar"
        >
          <Pencil className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          onClick={deleteQuote}
          className="h-4 w-4 inline-flex items-center justify-center text-destructive hover:bg-destructive/10 rounded"
          title="Eliminar"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

function QuickAddQuote({
  itemId,
  category,
  onChanged,
}: {
  itemId: string;
  category: QuoteCategory;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left text-[10px] text-slate-500 hover:text-slate-800 hover:bg-white border border-dashed border-slate-300 rounded px-1.5 py-1 transition-colors flex items-center gap-1"
      >
        <Plus className="h-2.5 w-2.5" />
        Agregar cotización
      </button>
    );
  }
  return (
    <QuoteInlineForm
      itemId={itemId}
      category={category}
      onSaved={() => {
        setOpen(false);
        onChanged();
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

function QuoteInlineForm({
  initial,
  itemId,
  category,
  onSaved,
  onCancel,
}: {
  initial?: Quote;
  itemId?: string;
  category?: QuoteCategory;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [supplier, setSupplier] = useState(initial?.supplierName ?? "");
  const [price, setPrice] = useState(
    initial ? String(initial.price) : "",
  );
  const [partCode, setPartCode] = useState(initial?.partCode ?? "");
  const [discount, setDiscount] = useState(
    initial?.discount != null ? String(initial.discount) : "",
  );
  const [availability, setAvailability] = useState(
    initial?.availability ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!supplier.trim() || !price.trim()) return;
    const discountTrim = discount.trim();
    if (discountTrim !== "") {
      const d = Number(discountTrim);
      if (!Number.isFinite(d) || d < 0 || d > 100) {
        alert("El descuento debe estar entre 0 y 100");
        return;
      }
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        supplierName: supplier.trim(),
        price: Number(price),
        partCode: partCode.trim() || undefined,
        discount: discountTrim !== "" ? Number(discountTrim) : null,
        availability: availability.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      let res: Response;
      if (initial) {
        res = await fetch(`/api/budget-admin-quotes/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        body.category = category;
        res = await fetch(`/api/budget-admin-items/${itemId}/quotes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      if (res.ok) {
        onSaved();
      } else {
        const b = await res.json().catch(() => ({}));
        alert(b?.error ?? "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded border border-slate-300 bg-white p-1.5 space-y-1 shadow-sm">
      <Input
        placeholder="Proveedor"
        value={supplier}
        onChange={(e) => setSupplier(e.target.value)}
        className="h-7 text-xs"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-1">
        <Input
          placeholder="$ Precio"
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="h-7 text-xs"
        />
        <Input
          placeholder="Desc. %"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Input
          placeholder="Código"
          value={partCode}
          onChange={(e) => setPartCode(e.target.value)}
          className="h-7 text-xs"
        />
        <Input
          placeholder="Disp."
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <Input
        placeholder="Notas (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="h-7 text-xs"
      />
      <div className="flex gap-1 pt-0.5">
        <Button
          size="sm"
          onClick={save}
          disabled={!supplier.trim() || !price.trim() || saving}
          className="h-6 text-[10px] flex-1 gap-1"
        >
          <Check className="h-3 w-3" />
          {initial ? "Guardar" : "Agregar"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-6 text-[10px] px-2"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab: Compras · spec Compras v2
// ─────────────────────────────────────────────────────────────────────────
//
// Consume la nueva shape `items[].purchases[]` — un ítem puede tener N
// compras (devoluciones, recompras). El circuito completo (Cotizar →
// Archivada) se gestiona en el detalle modal reutilizable.
//
// Botones:
//  · "Iniciar compra" (ítem sin compras): POST /api/purchases con status
//    inicial = COTIZAR o COMPRAR (si hay quote elegida, se usa esa).
//  · "Ver" (ojo): abre PurchaseDetailDialog reutilizable.

function ComprasTab({
  items,
  onChanged,
}: {
  items: Item[];
  onChanged: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<
    Array<{ id: string; name: string; isActive: boolean }>
  >([]);
  const [cashBoxes, setCashBoxes] = useState<
    Array<{ id: string; name: string; key: string }>
  >([]);

  useEffect(() => {
    (async () => {
      try {
        const [supRes, boxRes] = await Promise.all([
          fetch("/api/suppliers"),
          fetch("/api/caja/boxes"),
        ]);
        if (supRes.ok) {
          const d = (await supRes.json()) as {
            suppliers: Array<{ id: string; name: string; isActive: boolean }>;
          };
          setSuppliers(d.suppliers.filter((s) => s.isActive));
        }
        if (boxRes.ok) {
          const d = (await boxRes.json()) as {
            boxes: Array<{ id: string; name: string; key: string }>;
          };
          setCashBoxes(d.boxes);
        }
      } catch (e) {
        console.error("Error cargando suppliers/cajas", e);
      }
    })();
  }, []);

  if (items.length === 0) {
    return (
      <Card className="p-10 text-center border-dashed">
        <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">
          Cargá repuestos en la pestaña <strong>Cotizaciones</strong> antes de
          iniciar compras.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ItemPurchasesBlock
          key={item.id}
          item={item}
          onOpenDetail={setOpenId}
          onChanged={onChanged}
        />
      ))}

      {openId && (
        <PurchaseDetailDialog
          purchaseId={openId}
          suppliers={suppliers}
          cashBoxes={cashBoxes}
          onClose={() => setOpenId(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

function ItemPurchasesBlock({
  item,
  onOpenDetail,
  onChanged,
}: {
  item: Item;
  onOpenDetail: (id: string) => void;
  onChanged: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const minNet =
    item.quotes.length > 0
      ? Math.min(...item.quotes.map((q) => netPrice(q)))
      : null;
  const minQuote =
    minNet !== null
      ? (item.quotes.find((q) => netPrice(q) === minNet) ?? null)
      : null;

  // Inicia una compra vacía en COTIZAR. La decisión de quote / proveedor
  // se toma en el detalle modal.
  const initiate = async (chosenQuoteId?: string) => {
    setStarting(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          ...(chosenQuoteId && { chosenQuoteId, status: "COMPRAR" }),
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b?.error ?? `Error HTTP ${res.status}`);
        return;
      }
      const d = (await res.json()) as { purchase: { id: string } };
      onChanged();
      onOpenDetail(d.purchase.id);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-sm text-slate-800 truncate">
            {item.description}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {item.quotes.length > 0
              ? `${item.quotes.length} cotización${item.quotes.length === 1 ? "" : "es"}`
              : "Sin cotizaciones cargadas"}
            {minQuote && (
              <>
                {" · "}
                <span className="text-slate-600">
                  Mín: {minQuote.supplierName} · {ARS.format(minNet ?? 0)}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {minQuote && item.purchases.length === 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => initiate(minQuote.id)}
              disabled={starting}
              className="h-7 text-[11px] gap-1"
              title="Crea la compra directamente en 'Comprar' usando la cotización más barata"
            >
              {starting && <Loader2 className="h-3 w-3 animate-spin" />}
              <ShoppingCart className="h-3 w-3" />
              Comprar la mínima
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => initiate()}
            disabled={starting}
            className="h-7 text-[11px] gap-1"
          >
            {starting && <Loader2 className="h-3 w-3 animate-spin" />}
            <Plus className="h-3 w-3" />
            Nueva compra
          </Button>
        </div>
      </div>

      {item.purchases.length > 0 && (
        <div className="mt-2 rounded-md border overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-r border-slate-100 px-2 py-1.5 text-left font-semibold text-slate-600">
                  N° compra
                </th>
                <th className="border-b border-r border-slate-100 px-2 py-1.5 text-left font-semibold text-slate-600">
                  Proveedor
                </th>
                <th className="border-b border-r border-slate-100 px-2 py-1.5 text-right font-semibold text-slate-600">
                  Monto
                </th>
                <th className="border-b border-r border-slate-100 px-2 py-1.5 text-right font-semibold text-slate-600">
                  Flete
                </th>
                <th className="border-b border-r border-slate-100 px-2 py-1.5 text-left font-semibold text-slate-600">
                  Estado
                </th>
                <th className="border-b border-slate-100 px-1 py-1.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {item.purchases.map((p) => (
                <PurchaseInlineRow
                  key={p.id}
                  purchase={p}
                  onOpen={() => onOpenDetail(p.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const STATUS_TONE: Record<
  PurchaseSummary["status"],
  { bg: string; text: string; dot: string; label: string }
> = {
  COTIZAR: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500", label: "Cotizar" },
  DECIDIR: { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-500", label: "Decidir" },
  COMPRAR: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500", label: "Comprar" },
  EN_CAMINO: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500", label: "En camino" },
  EN_TALLER: { bg: "bg-cyan-100", text: "text-cyan-700", dot: "bg-cyan-500", label: "En taller" },
  PENDIENTE_PAGO: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500", label: "Pdte. pago" },
  ARCHIVADA: { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", label: "Archivada" },
};

function PurchaseInlineRow({
  purchase,
  onOpen,
}: {
  purchase: PurchaseSummary;
  onOpen: () => void;
}) {
  const tone = STATUS_TONE[purchase.status];
  return (
    <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
      <td className="border-r border-slate-100 px-2 py-1.5 font-mono text-[11px]">
        {purchase.number}
      </td>
      <td className="border-r border-slate-100 px-2 py-1.5">
        {purchase.supplierName ?? <span className="text-slate-400 italic">—</span>}
      </td>
      <td className="border-r border-slate-100 px-2 py-1.5 text-right font-mono tabular-nums">
        {Number(purchase.amount) > 0
          ? ARS.format(Number(purchase.amount))
          : <span className="text-slate-400">—</span>}
      </td>
      <td className="border-r border-slate-100 px-2 py-1.5 text-right font-mono tabular-nums">
        {Number(purchase.freightAmount) > 0
          ? ARS.format(Number(purchase.freightAmount))
          : <span className="text-slate-400">—</span>}
      </td>
      <td className="border-r border-slate-100 px-2 py-1.5">
        <span
          className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${tone.bg} ${tone.text}`}
        >
          <span className={`h-1 w-1 rounded-full ${tone.dot}`} />
          {tone.label}
        </span>
      </td>
      <td className="px-1 py-1.5 text-center">
        <button
          type="button"
          onClick={onOpen}
          className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-slate-100 text-slate-600"
          title="Ver detalle"
          aria-label="Ver detalle"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
