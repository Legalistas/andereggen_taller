"use client";

import { Building2, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

/**
 * spec 4.2 v2 · Cobros por vehículo.
 * Tabla derivada de RepairInvoice + payments. Cada row es un repair.
 * Al lado (o abajo en mobile) mostramos el desglose de "Cobros por
 * compañía" del mes (spec 4.4).
 */

type CollectionRow = {
  repairId: string;
  internalNumber: number | null;
  customerName: string;
  vehicleSummary: string;
  vehicleDomain: string;
  insuranceCompany: string | null;
  insuranceResponsibility: string | null;
  repairStatus: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "pendiente" | "parcial" | "total" | "sin_facturar";
  lastPaidAt: string | null;
  lastMethod: string | null;
  cashBoxes: Array<{ id: string; name: string; total: number }>;
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const STATUS_LABEL: Record<CollectionRow["status"], string> = {
  pendiente: "Pendiente",
  parcial: "Cobrado parcial",
  total: "Cobrado total",
  sin_facturar: "Sin facturar",
};

const STATUS_STYLE: Record<CollectionRow["status"], string> = {
  pendiente: "bg-rose-100 text-rose-700",
  parcial: "bg-amber-100 text-amber-700",
  total: "bg-emerald-100 text-emerald-700",
  sin_facturar: "bg-slate-100 text-slate-600",
};

const METHOD_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
  TARJETA: "Tarjeta",
  MERCADOPAGO: "Mercado Pago",
  OTRO: "Otro",
};

const DATE_FMT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type Props = {
  byInsurance: Array<{ insurance: string; total: number }>;
};

export default function CollectionsTable({ byInsurance }: Props) {
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const ac = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      fetch(`/api/caja/collections?${params.toString()}`, { signal: ac.signal })
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return (await r.json()) as { rows: CollectionRow[] };
        })
        .then((d) => setRows(d.rows))
        .catch((e) => {
          if ((e as Error).name !== "AbortError") {
            setError(e instanceof Error ? e.message : "Error");
          }
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [statusFilter, search]);

  const totalsByInsurance = useMemo(
    () => byInsurance.reduce((a, b) => a + b.total, 0),
    [byInsurance],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente, patente o Nº interno"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="parcial">Cobrado parcial</SelectItem>
                <SelectItem value="total">Cobrado total</SelectItem>
                <SelectItem value="sin_facturar">Sin facturar</SelectItem>
              </SelectContent>
            </Select>
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>
        </Card>

        {error && (
          <Card className="p-3 border-rose-200 bg-rose-50 text-sm text-rose-700">
            {error}
          </Card>
        )}

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">N° INT</TableHead>
                <TableHead>Cliente / Vehículo</TableHead>
                <TableHead>Seguro</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Cobrado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último cobro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && !loading && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-slate-500 py-8"
                  >
                    No hay cobros para mostrar.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.repairId}>
                  <TableCell className="tabular-nums font-medium">
                    {r.internalNumber ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/produccion?repairId=${r.repairId}`}
                      className="font-medium text-slate-900 hover:underline block"
                    >
                      {r.customerName}
                    </Link>
                    <div className="text-[11px] text-slate-500">
                      {r.vehicleSummary} · {r.vehicleDomain}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {r.insuranceCompany ?? (
                      <span className="text-slate-400 italic">Particular</span>
                    )}
                    {r.insuranceResponsibility && (
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
                        {r.insuranceResponsibility}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {ARS.format(r.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-700">
                    {ARS.format(r.paidAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-rose-700">
                    {ARS.format(r.remainingAmount)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded ${STATUS_STYLE[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {r.lastPaidAt ? (
                      <>
                        {DATE_FMT.format(new Date(r.lastPaidAt))}
                        {r.lastMethod && (
                          <div className="text-[10px] text-slate-500">
                            {METHOD_LABEL[r.lastMethod] ?? r.lastMethod}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Cobros por compañía — spec 4.4 */}
      <Card className="p-4 h-fit">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">
            Cobros por compañía
          </h3>
        </div>
        {byInsurance.length === 0 ? (
          <p className="text-xs text-slate-400 italic">
            No hay cobros registrados este mes.
          </p>
        ) : (
          <ul className="space-y-2">
            {byInsurance.map((b) => {
              const pct =
                totalsByInsurance > 0
                  ? Math.round((b.total / totalsByInsurance) * 100)
                  : 0;
              return (
                <li key={b.insurance} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 truncate">
                      {b.insurance}
                    </span>
                    <span className="tabular-nums font-medium text-slate-900">
                      {ARS.format(b.total)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#003b73]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
