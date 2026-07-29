"use client";

/**
 * Tabla del módulo Compras — spec Compras v2.
 * Columnas: N° presupuesto (clickeable) · N° compra · Vehículo · Repuesto ·
 * Categoría/Proveedor · Monto · Proveedor flete · Flete · Estado · Ojo.
 */

import { Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PURCHASE_STATUS_META } from "@/lib/purchases/catalog";
import type { PurchaseRow } from "./types";

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const CATEGORY_LABEL: Record<string, string> = {
  OFICIAL: "Oficial",
  ALTERNATIVO: "Alternativo",
  DESARMADERO: "Desarmadero",
};

const CATEGORY_TONE: Record<string, string> = {
  OFICIAL: "bg-blue-100 text-blue-700",
  ALTERNATIVO: "bg-amber-100 text-amber-700",
  DESARMADERO: "bg-slate-100 text-slate-700",
};

export default function PurchasesTable({
  rows,
  onOpenDetail,
}: {
  rows: PurchaseRow[];
  onOpenDetail: (row: PurchaseRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">N° Ppto</TableHead>
          <TableHead className="w-24">N° Compra</TableHead>
          <TableHead>Vehículo</TableHead>
          <TableHead>Repuesto</TableHead>
          <TableHead>Categoría / Proveedor</TableHead>
          <TableHead className="text-right">Monto</TableHead>
          <TableHead>Proveedor flete</TableHead>
          <TableHead className="text-right">Flete</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={10}
              className="text-center py-10 text-sm text-slate-500"
            >
              Sin compras en este estado.
            </TableCell>
          </TableRow>
        )}
        {rows.map((r) => {
          const meta = PURCHASE_STATUS_META[r.status];
          const repair = r.item.budget?.repair;
          const budgetLabel = r.item.budget
            ? r.item.budget.extensionSuffix && r.item.budget.extensionSuffix > 0
              ? `${r.item.budget.number}-A${r.item.budget.extensionSuffix}`
              : String(r.item.budget.number)
            : repair?.internalNumber
              ? `INT-${repair.internalNumber}`
              : "—";
          return (
            <TableRow key={r.id} className="hover:bg-slate-50">
              <TableCell>
                {repair ? (
                  <Link
                    href={`/produccion?repairId=${repair.id}`}
                    className="text-[#003b73] hover:underline font-mono text-xs font-semibold"
                  >
                    {budgetLabel}
                  </Link>
                ) : (
                  <span className="font-mono text-xs text-slate-400">
                    {budgetLabel}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs">{r.number}</span>
              </TableCell>
              <TableCell>
                {repair ? (
                  <div>
                    <div className="text-sm">
                      {repair.vehicleBrand} {repair.vehicleModel}
                    </div>
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      {repair.vehicleDomain}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell className="max-w-64">
                <div className="text-sm truncate" title={r.item.description}>
                  {r.item.description}
                </div>
                {repair?.customerName && (
                  <div className="text-[10px] text-slate-400 truncate">
                    {repair.customerName}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  {r.category && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold w-fit ${
                        CATEGORY_TONE[r.category] ?? "bg-slate-100"
                      }`}
                    >
                      {CATEGORY_LABEL[r.category] ?? r.category}
                    </span>
                  )}
                  <span className="text-xs text-slate-700">
                    {r.supplierName ?? r.supplier?.name ?? (
                      <span className="text-slate-400 italic">
                        Sin proveedor
                      </span>
                    )}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {Number(r.amount) > 0 ? (
                  ARS.format(Number(r.amount))
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-slate-700">
                {r.freightSupplierName ??
                  r.freightSupplier?.name ?? (
                    <span className="text-slate-400 italic">—</span>
                  )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {Number(r.freightAmount) > 0 ? (
                  ARS.format(Number(r.freightAmount))
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${meta.tone.bg} ${meta.tone.text}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${meta.tone.dot}`}
                  />
                  {meta.label}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenDetail(r)}
                  className="h-8 w-8 p-0"
                  aria-label="Ver detalle"
                  title="Ver detalle (fechas, cotizaciones, notas)"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
