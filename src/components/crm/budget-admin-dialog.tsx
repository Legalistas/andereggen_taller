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
  PackageCheck,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import NewDirectPurchaseDialog from "@/components/compras/new-direct-purchase-dialog";
import PurchaseDetailDialog from "@/components/compras/purchase-detail-dialog";
import {
  invalidateCache,
  loadCashBoxes,
  loadSuppliers,
  SUPPLIERS_KEY,
} from "@/lib/client-cache";
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
// Catálogo compartido de estados: la administrativa tenía su propia copia y
// se quedó sin "Seguro", lo que rompía el tab Compras de los vehículos cuyos
// repuestos manda la aseguradora.
import { PURCHASE_STATUS_META } from "@/lib/purchases/catalog";
import type { PurchaseStatus } from "../../../generated/prisma/client";

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
  status: PurchaseStatus;
  category: QuoteCategory | null;
  supplierName: string | null;
  amount: string | number;
  freightAmount: string | number;
  freightSupplierName: string | null;
  purchasedAt: string | null;
  receivedAt: string | null;
  paidPartsAt: string | null;
  paidFreightAt: string | null;
  /** Descripción propia de las compras sueltas (sin repuesto asociado). */
  productDescription?: string | null;
  /** Pagos parciales — se usan para el estado de pago de la fila. */
  payments?: Array<{ kind: "PARTS" | "FREIGHT"; amount: string | number }>;
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
  /**
   * spec Compras v4 · Compras del vehículo que no cuelgan de ningún repuesto
   * (insumos, un flete suelto). Antes solo existían en el módulo Compras.
   */
  const [directPurchases, setDirectPurchases] = useState<PurchaseSummary[]>([]);
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
      const data = (await res.json()) as {
        items: Item[];
        directPurchases?: PurchaseSummary[];
      };
      setItems(data.items);
      setDirectPurchases(data.directPurchases ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setItems(null);
      setDirectPurchases([]);
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
  const effectiveTotal = (list: PurchaseSummary[]) =>
    list.reduce((s, p) => {
      if (p.status === "COTIZAR" || p.status === "DECIDIR") return s;
      return s + Number(p.amount) + Number(p.freightAmount);
    }, 0);

  const totalSpent =
    (items ?? []).reduce((sum, it) => sum + effectiveTotal(it.purchases), 0) +
    // Las compras sueltas del vehículo (insumos, fletes aparte) también
    // salieron de la caja por este auto, así que suman al gastado.
    effectiveTotal(directPurchases);

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
                    const total =
                      (items ?? []).reduce(
                        (n, it) => n + it.purchases.length,
                        0,
                      ) + directPurchases.length;
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
                <ComprasTab
                  items={items}
                  directPurchases={directPurchases}
                  budgetId={budgetId}
                  onChanged={refresh}
                />
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
// Autocomplete para "Agregar repuesto" — sugiere descripciones históricas
// (más usadas primero) para reducir tipeo y unificar nomenclatura.
// ─────────────────────────────────────────────────────────────────────────

function ItemDescriptionAutocomplete({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const [suggestions, setSuggestions] = useState<
    Array<{ description: string; uses: number }>
  >([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [loadingSug, setLoadingSug] = useState(false);

  // Debounce del fetch — 200ms.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoadingSug(true);
      try {
        const params = new URLSearchParams();
        if (value.trim()) params.set("q", value.trim());
        params.set("limit", "12");
        const res = await fetch(
          `/api/budget-admin-items/suggestions?${params.toString()}`,
        );
        const raw = await res.text();
        const body = raw ? JSON.parse(raw) : {};
        setSuggestions(body.suggestions ?? []);
        setHighlight(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSug(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [value, open]);

  // Cerrar al click fuera. Marcamos el wrapper con data-autocomplete para
  // detectar el ancestor sin depender del ref en la deps (los refs no
  // participan en los deps de un useEffect).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest("[data-autocomplete='item-description']")) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (s: string) => {
    onChange(s);
    setOpen(false);
  };

  // Filtrado local: si lo tipeado no coincide con ninguna sugerencia exacta,
  // sumamos una fila "Crear «xxx»" para dejar claro que va a crear uno nuevo.
  const typed = value.trim();
  const hasExactMatch = suggestions.some(
    (s) => s.description.toLowerCase() === typed.toLowerCase(),
  );
  const showCreateRow = typed.length > 0 && !hasExactMatch;

  return (
    <div
      data-autocomplete="item-description"
      className="relative flex-1"
    >
      <Input
        placeholder="Buscar o escribir descripción (ej: paragolpes delantero)"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) =>
              Math.min(suggestions.length - 1 + (showCreateRow ? 1 : 0), h + 1),
            );
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(-1, h - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && highlight >= 0 && highlight < suggestions.length) {
              pick(suggestions[highlight].description);
            } else {
              onSubmit();
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-md border border-slate-200 bg-white shadow-lg max-h-72 overflow-y-auto">
          {loadingSug && suggestions.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-500 italic">
              Buscando…
            </div>
          )}
          {!loadingSug && suggestions.length === 0 && !showCreateRow && (
            <div className="px-3 py-2 text-xs text-slate-500 italic">
              Sin sugerencias todavía. Escribí una descripción y presioná
              Agregar.
            </div>
          )}
          {suggestions.map((s, i) => {
            const isHighlighted = i === highlight;
            return (
              <button
                key={s.description}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s.description);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-3 ${
                  isHighlighted ? "bg-slate-100" : "hover:bg-slate-50"
                }`}
              >
                <span className="truncate">{s.description}</span>
                <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                  {s.uses}×
                </span>
              </button>
            );
          })}
          {showCreateRow && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSubmit();
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm border-t border-slate-100 ${
                highlight === suggestions.length
                  ? "bg-emerald-50"
                  : "hover:bg-emerald-50/50"
              }`}
            >
              <span className="text-emerald-700 font-medium">
                + Crear «{typed}»
              </span>
            </button>
          )}
        </div>
      )}
    </div>
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
          <ItemDescriptionAutocomplete
            value={newItemDescription}
            onChange={setNewItemDescription}
            onSubmit={addItem}
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
  directPurchases,
  budgetId,
  onChanged,
}: {
  items: Item[];
  /** Compras del vehículo sin repuesto asociado. */
  directPurchases: PurchaseSummary[];
  budgetId: string | null;
  onChanged: () => void;
}) {
  const [newDirectOpen, setNewDirectOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  /**
   * spec Compras v4 · Selección múltiple de compras del vehículo. Cuando
   * llega el pedido, el taller marca de una todos los repuestos que vinieron
   * juntos en vez de abrir compra por compra.
   */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDate, setBulkDate] = useState(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  });
  const [bulkBusy, setBulkBusy] = useState<null | "purchase" | "receive">(null);
  const [suppliers, setSuppliers] = useState<
    Array<{ id: string; name: string; isActive: boolean }>
  >([]);
  const [cashBoxes, setCashBoxes] = useState<
    Array<{ id: string; name: string; key: string }>
  >([]);

  // Refetch de suppliers — expuesto como callback para que el detalle de
  // compra pueda regenerar la lista después de crear un proveedor inline.
  // Invalida el cache module-level para que el resto de la app también vea
  // el proveedor nuevo.
  const refreshSuppliers = useCallback(async () => {
    invalidateCache(SUPPLIERS_KEY);
    try {
      const list = await loadSuppliers();
      setSuppliers(list.filter((s) => s.isActive));
    } catch (e) {
      console.error("Error recargando suppliers", e);
    }
  }, []);

  // Perf audit: mount usa el cache (no invalida). Ambos en paralelo.
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadSuppliers(), loadCashBoxes()])
      .then(([sup, boxes]) => {
        if (cancelled) return;
        setSuppliers(sup.filter((s) => s.isActive));
        setCashBoxes(boxes);
      })
      .catch((e) => console.error("Error cargando sidecars", e));
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0 && directPurchases.length === 0) {
    return (
      <Card className="p-10 text-center border-dashed">
        <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">
          Cargá repuestos en la pestaña <strong>Cotizaciones</strong> antes de
          iniciar compras, o registrá una compra suelta del vehículo.
        </p>
        {budgetId && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setNewDirectOpen(true)}
            className="mt-3 h-7 text-[11px] gap-1"
          >
            <Plus className="h-3 w-3" />
            Compra suelta
          </Button>
        )}
        {newDirectOpen && budgetId && (
          <NewDirectPurchaseDialog
            fixedBudgetId={budgetId}
            onClose={() => setNewDirectOpen(false)}
            onCreated={(purchaseId) => {
              setNewDirectOpen(false);
              onChanged();
              setOpenId(purchaseId);
            }}
          />
        )}
      </Card>
    );
  }

  const toggleSelect = (id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });
  };

  /**
   * Acciones en lote sobre las compras tildadas del vehículo, todas con la
   * misma fecha: el pedido al proveedor o la llegada al taller.
   */
  const runBulk = async (action: "purchase" | "receive") => {
    if (selectedIds.size === 0) return;
    setBulkBusy(action);
    try {
      const [y, m, d] = bulkDate.split("-").map(Number);
      const res = await fetch("/api/purchases/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [...selectedIds],
          action,
          // Mediodía local: evita que el server (UTC) lo tome como el día
          // anterior.
          date: new Date(y, m - 1, d, 12, 0, 0).toISOString(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      if (body?.skipped > 0) {
        alert(
          `${body.skipped} compra(s) quedaron sin marcar porque todavía están en Cotizar${
            action === "receive" ? " o Definir" : ""
          }.`,
        );
      }
      setSelectedIds(new Set());
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo aplicar la acción");
    } finally {
      setBulkBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 rounded-md border border-[#003b73]/20 bg-[#003b73]/5 px-3 py-2 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-slate-700">
            {selectedIds.size}{" "}
            {selectedIds.size === 1
              ? "repuesto seleccionado"
              : "repuestos seleccionados"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">Fecha</span>
            <Input
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
              className="h-8 w-40 bg-white"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => runBulk("purchase")}
            disabled={bulkBusy !== null}
            className="h-8 gap-1.5 bg-white"
            title="Se hizo el pedido al proveedor: pasan a En camino con esta fecha"
          >
            {bulkBusy === "purchase" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShoppingCart className="h-3.5 w-3.5" />
            )}
            Marcar como compradas
          </Button>
          <Button
            size="sm"
            onClick={() => runBulk("receive")}
            disabled={bulkBusy !== null}
            className="h-8 gap-1.5"
            title="Llegaron al taller: quedan recibidas con esta fecha"
          >
            {bulkBusy === "receive" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PackageCheck className="h-3.5 w-3.5" />
            )}
            Marcar como llegados
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            className="h-8 text-slate-600"
          >
            Limpiar
          </Button>
        </div>
      )}

      {items.map((item) => (
        <ItemPurchasesBlock
          key={item.id}
          item={item}
          onOpenDetail={setOpenId}
          onChanged={onChanged}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      ))}

      {/* Compras del vehículo que no salen de un repuesto de la lista:
          insumos, un sellador, un flete aparte. Se cargan acá para no tener
          que ir al módulo Compras a buscar el presupuesto. */}
      <Card className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">
              Compras sueltas del vehículo
            </p>
            <p className="text-[11px] text-muted-foreground">
              Sin repuesto asociado — insumos, fletes, gastos varios.
            </p>
          </div>
          {budgetId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNewDirectOpen(true)}
              className="h-7 text-[11px] gap-1 shrink-0"
            >
              <Plus className="h-3 w-3" />
              Compra suelta
            </Button>
          )}
        </div>

        {directPurchases.length > 0 ? (
          <div className="mt-2 rounded-md border overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-r border-slate-100 px-1 py-1.5 w-8"></th>
                  <th className="border-b border-r border-slate-100 px-2 py-1.5 text-left font-semibold text-slate-600">
                    N° compra
                  </th>
                  <th className="border-b border-r border-slate-100 px-2 py-1.5 text-left font-semibold text-slate-600">
                    Producto
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
                    Pago
                  </th>
                  <th className="border-b border-r border-slate-100 px-2 py-1.5 text-left font-semibold text-slate-600">
                    Recepción
                  </th>
                  <th className="border-b border-r border-slate-100 px-2 py-1.5 text-left font-semibold text-slate-600">
                    Estado
                  </th>
                  <th className="border-b border-slate-100 px-1 py-1.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {directPurchases.map((p) => (
                  <PurchaseInlineRow
                    key={p.id}
                    purchase={p}
                    product={p.productDescription}
                    selected={selectedIds.has(p.id)}
                    onToggleSelect={(next) => toggleSelect(p.id, next)}
                    onOpen={() => setOpenId(p.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground italic">
            Sin compras sueltas para este vehículo.
          </p>
        )}
      </Card>

      {newDirectOpen && budgetId && (
        <NewDirectPurchaseDialog
          fixedBudgetId={budgetId}
          onClose={() => setNewDirectOpen(false)}
          onCreated={(purchaseId) => {
            setNewDirectOpen(false);
            onChanged();
            setOpenId(purchaseId);
          }}
        />
      )}

      {openId && (
        <PurchaseDetailDialog
          purchaseId={openId}
          suppliers={suppliers}
          cashBoxes={cashBoxes}
          onClose={() => setOpenId(null)}
          onChanged={onChanged}
          onSuppliersChanged={refreshSuppliers}
        />
      )}
    </div>
  );
}

function ItemPurchasesBlock({
  item,
  onOpenDetail,
  onChanged,
  selectedIds,
  onToggleSelect,
}: {
  item: Item;
  onOpenDetail: (id: string) => void;
  onChanged: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, next: boolean) => void;
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
                <th className="border-b border-r border-slate-100 px-1 py-1.5 w-8"></th>
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
                  Pago
                </th>
                <th className="border-b border-r border-slate-100 px-2 py-1.5 text-left font-semibold text-slate-600">
                  Recepción
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
                  selected={selectedIds.has(p.id)}
                  onToggleSelect={(next) => onToggleSelect(p.id, next)}
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

/**
 * Fila de compra dentro de la administrativa del vehículo.
 *
 * spec Compras v4 · Muestra pago y fecha de recepción además del estado, y
 * toda la fila abre el detalle completo: la idea es no tener que ir al módulo
 * Compras para ver o corregir algo del repuesto.
 */
function PurchaseInlineRow({
  purchase,
  product,
  selected,
  onToggleSelect,
  onOpen,
}: {
  purchase: PurchaseSummary;
  /**
   * Solo para compras sueltas: el producto no sale de un repuesto de la
   * lista, así que se muestra en una columna propia.
   */
  product?: string | null;
  selected: boolean;
  onToggleSelect: (next: boolean) => void;
  onOpen: () => void;
}) {
  const meta = PURCHASE_STATUS_META[purchase.status];
  // Mismo cálculo que usa el módulo Compras: suma de pagos parciales contra
  // repuesto + flete, con el margen de un centavo por redondeos.
  const total = Number(purchase.amount) + Number(purchase.freightAmount);
  const paid = (purchase.payments ?? []).reduce(
    (s, x) => s + Number(x.amount),
    0,
  );
  const payLabel =
    total === 0
      ? { text: "—", cls: "text-slate-400" }
      : paid + 0.01 >= total
        ? { text: "Pagada", cls: "text-emerald-700 bg-emerald-50" }
        : paid > 0
          ? { text: "Parcial", cls: "text-amber-700 bg-amber-50" }
          : { text: "Sin pagar", cls: "text-slate-600 bg-slate-100" };

  return (
    <tr
      className={`border-b border-slate-100 last:border-b-0 ${
        selected ? "bg-[#003b73]/5" : "hover:bg-slate-50/50"
      }`}
    >
      <td className="border-r border-slate-100 px-1 py-1.5 text-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onToggleSelect(e.target.checked)}
          aria-label={`Seleccionar compra ${purchase.number}`}
          className="h-3.5 w-3.5 rounded border-slate-300 text-[#003b73] focus:ring-[#003b73]"
        />
      </td>
      <td className="border-r border-slate-100 px-2 py-1.5 font-mono text-[11px]">
        <button
          type="button"
          onClick={onOpen}
          className="hover:underline text-[#003b73]"
          title="Ver y editar el detalle de la compra"
        >
          {purchase.number}
        </button>
      </td>
      {product !== undefined && (
        <td className="border-r border-slate-100 px-2 py-1.5 max-w-48">
          <span className="block truncate" title={product ?? ""}>
            {product ?? <span className="text-slate-400 italic">—</span>}
          </span>
        </td>
      )}
      <td className="border-r border-slate-100 px-2 py-1.5">
        {purchase.supplierName ?? (
          <span className="text-slate-400 italic">—</span>
        )}
      </td>
      <td className="border-r border-slate-100 px-2 py-1.5 text-right font-mono tabular-nums">
        {Number(purchase.amount) > 0 ? (
          ARS.format(Number(purchase.amount))
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="border-r border-slate-100 px-2 py-1.5 text-right font-mono tabular-nums">
        {Number(purchase.freightAmount) > 0 ? (
          ARS.format(Number(purchase.freightAmount))
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="border-r border-slate-100 px-2 py-1.5">
        <span
          className={`inline-block text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${payLabel.cls}`}
        >
          {payLabel.text}
        </span>
      </td>
      <td className="border-r border-slate-100 px-2 py-1.5 text-[11px] text-slate-600 tabular-nums">
        {purchase.receivedAt ? (
          formatShortDate(purchase.receivedAt)
        ) : (
          <span className="text-slate-400 italic">Sin llegar</span>
        )}
      </td>
      <td className="border-r border-slate-100 px-2 py-1.5">
        <span
          className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${meta.tone.bg} ${meta.tone.text}`}
        >
          <span className={`h-1 w-1 rounded-full ${meta.tone.dot}`} />
          {meta.label}
        </span>
      </td>
      <td className="px-1 py-1.5 text-center">
        <button
          type="button"
          onClick={onOpen}
          className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-slate-100 text-slate-600"
          title="Ver y editar el detalle"
          aria-label="Ver detalle"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

/** Fecha corta local para las columnas de la tabla de compras. */
function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}
