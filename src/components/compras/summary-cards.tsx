/**
 * Tarjetas resumen del módulo Compras — spec Compras v2.
 * Se muestran a nivel global (/compras) y también dentro de la ficha
 * Administrativa filtradas por budgetId.
 */

import { CheckCircle2, ListChecks, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PurchaseRow } from "./types";

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export type Summary = {
  itemsRegistered: number;
  totalPurchased: number;
  estimatedPending: number;
};

/**
 * Calcula las 3 métricas del brief:
 *  - Ítems registrados: cantidad de BudgetAdminItem únicos representados.
 *  - Total comprado: suma de `amount` de compras con status distinto de
 *    COTIZAR/DECIDIR (o sea, con proveedor definido — ya se está gestionando).
 *  - Estimado pendiente: para los ítems sin compra "efectiva" todavía, la
 *    cotización más baja (mejor). Como no tenemos las quotes en el shape
 *    del listado, el server debe pasar esto pre-calculado si se quiere el
 *    número exacto — acá aproximamos con lo que hay.
 */
export function computeSummary(purchases: PurchaseRow[]): Summary {
  const items = new Set<string>();
  let totalPurchased = 0;
  let estimatedPending = 0;

  for (const p of purchases) {
    items.add(p.item?.id ?? p.id);
    const amt = Number(p.amount);
    // "Comprado" = pasó de COTIZAR/DECIDIR (tiene proveedor + monto)
    if (p.status !== "COTIZAR" && p.status !== "DECIDIR") {
      totalPurchased += amt;
    } else if (amt > 0) {
      // COTIZAR/DECIDIR con monto tentativo cuenta como estimado.
      estimatedPending += amt;
    }
  }

  return {
    itemsRegistered: items.size,
    totalPurchased,
    estimatedPending,
  };
}

export default function SummaryCards({ purchases }: { purchases: PurchaseRow[] }) {
  const summary = computeSummary(purchases);
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded bg-slate-100">
            <ListChecks className="h-4 w-4 text-slate-700" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              Ítems registrados
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {summary.itemsRegistered}
            </div>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded bg-emerald-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              Total comprado
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {ARS.format(summary.totalPurchased)}
            </div>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded bg-amber-50">
            <Wallet className="h-4 w-4 text-amber-700" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              Estimado pendiente
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {ARS.format(summary.estimatedPending)}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
