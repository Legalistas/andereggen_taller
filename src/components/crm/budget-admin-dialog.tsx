"use client";

/**
 * Modal "Administrativa" del presupuesto.
 *
 * Reemplaza la pestaña Excel donde el equipo registra:
 *   - Pre-cierre: cotizaciones de proveedores por repuesto (con fotos)
 *   - Post-ingreso: la compra final (proveedor elegido + monto pagado)
 *
 * IMPORTANTE: toda la información de este modal es de uso interno —
 * NUNCA aparece en el PDF que se le envía al cliente.
 */

import { Camera, ClipboardList, Lock, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

type Quote = {
  id: string;
  supplierName: string;
  price: string | number;
  notes: string | null;
};

type Purchase = {
  id: string;
  supplierName: string;
  amount: string | number;
  purchasedAt: string;
  notes: string | null;
  receiptUrl: string | null;
};

type Item = {
  id: string;
  order: number;
  description: string;
  notes: string | null;
  photos: string[];
  quotes: Quote[];
  purchase: Purchase | null;
};

type Props = {
  budgetId: string | null;
  budgetNumber?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BudgetAdminDialog({
  budgetId,
  budgetNumber,
  open,
  onOpenChange,
}: Props) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newItemDescription, setNewItemDescription] = useState("");

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

  const totalSpent = (items ?? []).reduce((sum, it) => {
    if (!it.purchase) return sum;
    return sum + Number(it.purchase.amount);
  }, 0);

  const totalQuoted = (items ?? []).reduce((sum, it) => {
    // Para items sin compra todavía, sumamos la cotización más baja como estimado.
    if (it.purchase) return sum;
    if (it.quotes.length === 0) return sum;
    const min = Math.min(...it.quotes.map((q) => Number(q.price)));
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col sm:rounded-xl overflow-hidden"
      >
        <DialogTitle className="sr-only">
          Administrativa del presupuesto{" "}
          {budgetNumber ? `#${budgetNumber}` : ""}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Información interna: cotizaciones de proveedores y compras realizadas.
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
                Información interna del taller — no aparece en el PDF al cliente
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-muted/20">
          {/* Resumen */}
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

          {items && items.length === 0 && (
            <Card className="p-10 text-center border-dashed">
              <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                Todavía no agregaste repuestos para esta administrativa.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cargá abajo la descripción del primer repuesto a cotizar.
              </p>
            </Card>
          )}

          {items && items.length > 0 && (
            <div className="space-y-3">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} onChanged={refresh} />
              ))}
            </div>
          )}

          {/* Agregar item */}
          <Card className="p-4 border-dashed">
            <Label className="text-xs text-muted-foreground">
              Agregar repuesto
            </Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                placeholder="Descripción del repuesto a cotizar (ej: paragolpes delantero)"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ItemCard — un repuesto con fotos, cotizaciones y compra
// ─────────────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onChanged,
}: {
  item: Item;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftDesc, setDraftDesc] = useState(item.description);
  const [draftNotes, setDraftNotes] = useState(item.notes ?? "");
  const [draftPhotos, setDraftPhotos] = useState<string[]>(item.photos);
  const [newPhoto, setNewPhoto] = useState("");

  const minQuote =
    item.quotes.length > 0
      ? Math.min(...item.quotes.map((q) => Number(q.price)))
      : null;

  const saveItem = async () => {
    const res = await fetch(`/api/budget-admin-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: draftDesc,
        notes: draftNotes,
        photos: draftPhotos,
      }),
    });
    if (res.ok) {
      setEditing(false);
      onChanged();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body?.error ?? "Error al guardar");
    }
  };

  const deleteItem = async () => {
    if (!confirm(`¿Eliminar "${item.description}" y sus cotizaciones?`)) return;
    const res = await fetch(`/api/budget-admin-items/${item.id}`, {
      method: "DELETE",
    });
    if (res.ok) onChanged();
  };

  const addPhotoUrl = () => {
    const url = newPhoto.trim();
    if (!url) return;
    setDraftPhotos((prev) => [...prev, url]);
    setNewPhoto("");
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        {editing ? (
          <div className="flex-1 space-y-2">
            <Input
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              placeholder="Descripción del repuesto"
            />
            <Textarea
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              placeholder="Notas internas (opcional)"
              rows={2}
            />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Fotos (URLs — Drive, etc.)
              </Label>
              {draftPhotos.length > 0 && (
                <ul className="space-y-1">
                  {draftPhotos.map((url, idx) => (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: orden estable mientras se edita
                      key={`${url}-${idx}`}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <Camera className="h-3 w-3 shrink-0 text-slate-400" />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 truncate text-blue-600 hover:underline"
                      >
                        {url}
                      </a>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={() =>
                          setDraftPhotos((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-1.5">
                <Input
                  value={newPhoto}
                  onChange={(e) => setNewPhoto(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPhotoUrl();
                    }
                  }}
                  className="flex-1 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addPhotoUrl}
                  disabled={!newPhoto.trim()}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveItem}>
                Guardar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraftDesc(item.description);
                  setDraftNotes(item.notes ?? "");
                  setDraftPhotos(item.photos);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="flex-1 text-left"
            onClick={() => setEditing(true)}
          >
            <h4 className="font-semibold text-slate-800">{item.description}</h4>
            {item.notes && (
              <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
                {item.notes}
              </p>
            )}
            {item.photos.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {item.photos.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline bg-blue-50 px-1.5 py-0.5 rounded"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Camera className="h-2.5 w-2.5" />
                    {url.length > 40 ? `${url.slice(0, 40)}…` : url}
                  </a>
                ))}
              </div>
            )}
          </button>
        )}
        {!editing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive shrink-0"
            onClick={deleteItem}
            aria-label="Eliminar item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Cotizaciones */}
      <QuotesBlock item={item} minQuote={minQuote} onChanged={onChanged} />

      {/* Compra */}
      <PurchaseBlock item={item} onChanged={onChanged} />
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// QuotesBlock — N cotizaciones por item
// ─────────────────────────────────────────────────────────────────────────

function QuotesBlock({
  item,
  minQuote,
  onChanged,
}: {
  item: Item;
  minQuote: number | null;
  onChanged: () => void;
}) {
  const [supplier, setSupplier] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  const addQuote = async () => {
    if (!supplier.trim() || !price.trim()) return;
    const res = await fetch(
      `/api/budget-admin-items/${item.id}/quotes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: supplier.trim(),
          price: Number(price),
          notes: notes.trim() || undefined,
        }),
      },
    );
    if (res.ok) {
      setSupplier("");
      setPrice("");
      setNotes("");
      onChanged();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body?.error ?? "Error al agregar cotización");
    }
  };

  const deleteQuote = async (qid: string) => {
    if (!confirm("¿Eliminar esta cotización?")) return;
    const res = await fetch(`/api/budget-admin-quotes/${qid}`, {
      method: "DELETE",
    });
    if (res.ok) onChanged();
  };

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Cotizaciones de proveedores ({item.quotes.length})
      </div>
      {item.quotes.length > 0 && (
        <ul className="space-y-1">
          {item.quotes.map((q) => {
            const isMin = minQuote !== null && Number(q.price) === minQuote;
            return (
              <li
                key={q.id}
                className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${
                  isMin ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50"
                }`}
              >
                <span className="font-medium text-slate-800 min-w-[120px] truncate">
                  {q.supplierName}
                </span>
                <span
                  className={`font-mono ${isMin ? "text-emerald-700 font-bold" : "text-slate-700"}`}
                >
                  {ARS.format(Number(q.price))}
                </span>
                {isMin && item.quotes.length > 1 && (
                  <span className="text-[9px] uppercase font-semibold text-emerald-700">
                    Mejor
                  </span>
                )}
                {q.notes && (
                  <span className="text-[10px] text-slate-500 italic flex-1 truncate">
                    {q.notes}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 ml-auto text-destructive"
                  onClick={() => deleteQuote(q.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="grid grid-cols-[1fr_120px_1fr_auto] gap-1.5">
        <Input
          placeholder="Proveedor"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="text-xs h-8"
        />
        <Input
          placeholder="$ Precio"
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="text-xs h-8"
        />
        <Input
          placeholder="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-xs h-8"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={addQuote}
          disabled={!supplier.trim() || !price.trim()}
          className="h-8 gap-1"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PurchaseBlock — 0..1 compra realizada por item
// ─────────────────────────────────────────────────────────────────────────

function PurchaseBlock({
  item,
  onChanged,
}: {
  item: Item;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(item.purchase === null);
  const [supplier, setSupplier] = useState(item.purchase?.supplierName ?? "");
  const [amount, setAmount] = useState(
    item.purchase ? String(item.purchase.amount) : "",
  );
  const [notes, setNotes] = useState(item.purchase?.notes ?? "");
  const [receiptUrl, setReceiptUrl] = useState(item.purchase?.receiptUrl ?? "");

  useEffect(() => {
    setSupplier(item.purchase?.supplierName ?? "");
    setAmount(item.purchase ? String(item.purchase.amount) : "");
    setNotes(item.purchase?.notes ?? "");
    setReceiptUrl(item.purchase?.receiptUrl ?? "");
    setEditing(item.purchase === null);
  }, [item.purchase]);

  const savePurchase = async () => {
    if (!supplier.trim() || !amount.trim()) return;
    const res = await fetch(
      `/api/budget-admin-items/${item.id}/purchase`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: supplier.trim(),
          amount: Number(amount),
          notes: notes.trim() || undefined,
          receiptUrl: receiptUrl.trim() || undefined,
        }),
      },
    );
    if (res.ok) {
      setEditing(false);
      onChanged();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body?.error ?? "Error al guardar compra");
    }
  };

  const removePurchase = async () => {
    if (!confirm("¿Quitar la marca de compra?")) return;
    const res = await fetch(
      `/api/budget-admin-items/${item.id}/purchase`,
      { method: "DELETE" },
    );
    if (res.ok) onChanged();
  };

  if (item.purchase && !editing) {
    return (
      <div className="border-t pt-3">
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              ✓ Comprado
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={() => setEditing(true)}
              >
                Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] text-destructive"
                onClick={removePurchase}
              >
                Quitar
              </Button>
            </div>
          </div>
          <div className="text-sm font-semibold text-emerald-900">
            {item.purchase.supplierName} —{" "}
            {ARS.format(Number(item.purchase.amount))}
          </div>
          <div className="text-[11px] text-emerald-700">
            {new Date(item.purchase.purchasedAt).toLocaleDateString("es-AR")}
            {item.purchase.notes && ` · ${item.purchase.notes}`}
            {item.purchase.receiptUrl && (
              <>
                {" · "}
                <a
                  href={item.purchase.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Comprobante
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Registrar compra
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Proveedor"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="text-xs h-8"
        />
        <Input
          placeholder="$ Monto pagado"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="text-xs h-8"
        />
        <Input
          placeholder="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-xs h-8"
        />
        <Input
          placeholder="URL comprobante (opcional)"
          value={receiptUrl}
          onChange={(e) => setReceiptUrl(e.target.value)}
          className="text-xs h-8"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={savePurchase}
          disabled={!supplier.trim() || !amount.trim()}
        >
          {item.purchase ? "Guardar cambios" : "Marcar como comprado"}
        </Button>
        {item.purchase && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
