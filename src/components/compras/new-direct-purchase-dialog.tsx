"use client";

/**
 * spec Compras v3 · Modal "Nueva compra" desde la etapa Cotizar del módulo
 * Compras. Dos modos según lo que complete el usuario:
 *
 *   (A) Elige un presupuesto → la compra queda asociada al vehículo/lead.
 *       El circuito es el mismo que para compras del circuito lead.
 *   (B) No elige presupuesto → compra suelta (insumos, herramientas). El
 *       campo Producto es obligatorio en ambos modos.
 */

import { Loader2, Search } from "lucide-react";
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

type BudgetOption = {
  id: string;
  number: number;
  customerName: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleDomain: string;
};

export default function NewDirectPurchaseDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (purchaseId: string) => void;
}) {
  const [product, setProduct] = useState("");
  const [budgetSearch, setBudgetSearch] = useState("");
  const [budgetOptions, setBudgetOptions] = useState<BudgetOption[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<BudgetOption | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchBudgets = useCallback(async (q: string) => {
    if (!q.trim()) {
      setBudgetOptions([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/budgets?search=${encodeURIComponent(q)}&limit=15`,
      );
      const raw = await res.text();
      const body = raw ? JSON.parse(raw) : {};
      setBudgetOptions((body.budgets ?? []) as BudgetOption[]);
    } catch {
      setBudgetOptions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBudget) return;
    const t = setTimeout(() => searchBudgets(budgetSearch), 250);
    return () => clearTimeout(t);
  }, [budgetSearch, searchBudgets, selectedBudget]);

  const save = async () => {
    setError(null);
    if (!product.trim()) {
      setError("El campo Producto es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productDescription: product.trim(),
          ...(selectedBudget && { budgetId: selectedBudget.id }),
          status: "COTIZAR",
        }),
      });
      const raw = await res.text();
      const body = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      onCreated(body.purchase.id);
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
          <DialogTitle>Nueva compra</DialogTitle>
          <DialogDescription>
            Cargá una compra directa. Si es para un vehículo del taller,
            asocialá al presupuesto correspondiente. Si es un insumo o
            herramienta, dejá el presupuesto vacío.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Producto *</Label>
            <Input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="Ej: Selladores parabrisas, filtro aceite, guantes…"
              autoFocus
            />
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">
              N° de presupuesto{" "}
              <span className="text-slate-400">(opcional)</span>
            </Label>
            {selectedBudget ? (
              <div className="flex items-center justify-between rounded-md border bg-slate-50 px-2 py-1.5">
                <div className="text-xs">
                  <span className="font-mono font-semibold text-[#003b73]">
                    #{selectedBudget.number}
                  </span>{" "}
                  · {selectedBudget.customerName} ·{" "}
                  <span className="text-slate-500">
                    {selectedBudget.vehicleBrand} {selectedBudget.vehicleModel}{" "}
                    ({selectedBudget.vehicleDomain})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBudget(null);
                    setBudgetSearch("");
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    value={budgetSearch}
                    onChange={(e) => setBudgetSearch(e.target.value)}
                    placeholder="Buscar por N°, cliente o patente…"
                    className="pl-7 h-9"
                  />
                </div>
                {budgetSearch && (
                  <div className="rounded-md border max-h-52 overflow-y-auto">
                    {searching && (
                      <div className="p-2 text-xs text-slate-500">
                        Buscando…
                      </div>
                    )}
                    {!searching && budgetOptions.length === 0 && (
                      <div className="p-2 text-xs text-slate-400 italic">
                        Sin resultados. Podés dejar vacío para crear una
                        compra suelta.
                      </div>
                    )}
                    {budgetOptions.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBudget(b)}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 border-b last:border-b-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-[#003b73]">
                            #{b.number}
                          </span>
                          <span>{b.customerName}</span>
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {b.vehicleBrand} {b.vehicleModel} ({b.vehicleDomain})
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
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
          <Button onClick={save} disabled={saving || !product.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Crear compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
