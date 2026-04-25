"use client";

import {
  AlertCircle,
  Calendar,
  Car,
  CheckCircle2,
  DollarSign,
  Download,
  FileText,
  Loader2,
  PiggyBank,
  Plus,
  RefreshCw,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  PAYMENT_METHOD_BY_KEY,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
} from "@/lib/payments";
import type { PaymentMethod } from "../../../generated/prisma/client";

type IncomeItem = {
  id: string;
  leadId: string;
  number: number;
  customerName: string;
  customerEmail: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleDomain: string;
  acceptedAt: string | null;
  grandTotal: number;
  paid: number;
  balance: number;
  status: PaymentStatus;
  paymentsCount: number;
  lastPaymentAt: string | null;
};

type IncomeResponse = {
  period: { from: string; to: string };
  kpis: {
    facturado: number;
    cobrado: number;
    porCobrar: number;
    tasaCobranza: number;
    ventasMes: number;
    cobradoMes: number;
  };
  items: IncomeItem[];
  monthlySeries: Array<{
    month: string;
    label: string;
    billed: number;
    collected: number;
  }>;
  byMethod: Array<{ method: PaymentMethod; amount: number }>;
  topCustomers: Array<{
    name: string;
    email: string;
    paid: number;
    count: number;
  }>;
};

type PaymentRow = {
  id: string;
  amount: string | number;
  paidAt: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  createdBy: { id: string; name: string | null; email: string | null } | null;
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const ARS_PRECISE = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

export default function IncomeSection() {
  const [data, setData] = useState<IncomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"30d" | "90d" | "6m" | "12m">("6m");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">(
    "all",
  );

  // Dialog de pagos
  const [paymentsTarget, setPaymentsTarget] = useState<IncomeItem | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [addForm, setAddForm] = useState({
    amount: "",
    paidAt: new Date().toISOString().slice(0, 10),
    method: "EFECTIVO" as PaymentMethod,
    reference: "",
    notes: "",
  });
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Fetch principal
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const days =
        period === "30d"
          ? 30
          : period === "90d"
            ? 90
            : period === "6m"
              ? 180
              : 365;
      const from = new Date(Date.now() - days * 86400_000);
      const params = new URLSearchParams({
        dateFrom: from.toISOString(),
        dateTo: new Date().toISOString(),
      });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/reports/income?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as IncomeResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [period, search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchData, 200);
    return () => clearTimeout(t);
  }, [fetchData]);

  // Cargar pagos al abrir el dialog
  useEffect(() => {
    if (!paymentsTarget) {
      setPayments([]);
      setAddError(null);
      return;
    }
    setPaymentsLoading(true);
    fetch(`/api/budgets/${paymentsTarget.id}/payments`)
      .then((r) => r.json())
      .then((body) => setPayments(body.payments ?? []))
      .finally(() => setPaymentsLoading(false));
  }, [paymentsTarget]);

  const byMethodChart = useMemo(() => {
    if (!data) return [];
    return data.byMethod.map((m) => ({
      name: PAYMENT_METHOD_BY_KEY[m.method]?.label ?? m.method,
      value: m.amount,
      color: methodColor(m.method),
    }));
  }, [data]);

  const submitPayment = async () => {
    if (!paymentsTarget) return;
    const amount = Number(addForm.amount);
    if (!amount || amount <= 0) {
      setAddError("Ingresá un monto válido.");
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/budgets/${paymentsTarget.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paidAt: addForm.paidAt,
          method: addForm.method,
          reference: addForm.reference || null,
          notes: addForm.notes || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setAddForm({
        amount: "",
        paidAt: new Date().toISOString().slice(0, 10),
        method: "EFECTIVO",
        reference: "",
        notes: "",
      });
      // Recargar tanto el dialog como el reporte
      const r = await fetch(`/api/budgets/${paymentsTarget.id}/payments`);
      const data2 = await r.json();
      setPayments(data2.payments ?? []);
      await fetchData();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Error");
    } finally {
      setAddBusy(false);
    }
  };

  const deletePayment = async (pid: string) => {
    if (!paymentsTarget) return;
    if (!confirm("¿Eliminar este pago? La acción no se puede deshacer."))
      return;
    await fetch(`/api/payments/${pid}`, { method: "DELETE" });
    const r = await fetch(`/api/budgets/${paymentsTarget.id}/payments`);
    const data2 = await r.json();
    setPayments(data2.payments ?? []);
    await fetchData();
  };

  const exportCsv = () => {
    if (!data) return;
    const headers = [
      "Numero",
      "Cliente",
      "Email",
      "Vehiculo",
      "Patente",
      "Fecha aceptacion",
      "Total",
      "Cobrado",
      "Saldo",
      "Estado",
      "Pagos",
    ];
    const rows = data.items.map((i) =>
      [
        i.number,
        JSON.stringify(i.customerName),
        i.customerEmail,
        `${i.vehicleBrand} ${i.vehicleModel}`,
        i.vehicleDomain,
        i.acceptedAt ? new Date(i.acceptedAt).toLocaleDateString("es-AR") : "",
        i.grandTotal,
        i.paid,
        i.balance,
        PAYMENT_STATUS_LABELS[i.status].label,
        i.paymentsCount,
      ].join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ingresos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Reportes" }, { label: "Ingresos" }]} />
        <h1 className="text-3xl font-bold">Reportes — Ingresos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Facturado, cobrado y por cobrar de los presupuestos aceptados.
          Registrá pagos parciales desde el detalle.
        </p>
      </div>

      {/* Filtros */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <Input
            placeholder="Buscar por cliente, email o patente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:max-w-md"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!data}
              className="gap-2"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Recargar
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as typeof period)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Últimos 30 días</SelectItem>
                <SelectItem value="90d">Últimos 90 días</SelectItem>
                <SelectItem value="6m">Últimos 6 meses</SelectItem>
                <SelectItem value="12m">Último año</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Estado de cobro
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as PaymentStatus | "all")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pagado</SelectItem>
                <SelectItem value="partial">Parcial</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-6 border-destructive/40 bg-destructive/5">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {loading && !data && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 inline animate-spin mr-2" /> Calculando
          ingresos…
        </Card>
      )}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard
              label="Facturado"
              value={ARS.format(data.kpis.facturado)}
              icon={FileText}
              color="blue"
            />
            <KpiCard
              label="Cobrado"
              value={ARS.format(data.kpis.cobrado)}
              icon={PiggyBank}
              color="green"
            />
            <KpiCard
              label="Por cobrar"
              value={ARS.format(data.kpis.porCobrar)}
              icon={Wallet}
              color="red"
            />
            <KpiCard
              label="% Cobranza"
              value={`${data.kpis.tasaCobranza}%`}
              icon={TrendingUp}
              color="purple"
            />
            <KpiCard
              label="Ventas del mes"
              value={ARS.format(data.kpis.ventasMes)}
              icon={DollarSign}
              color="cyan"
            />
            <KpiCard
              label="Cobrado este mes"
              value={ARS.format(data.kpis.cobradoMes)}
              icon={Trophy}
              color="orange"
            />
          </div>

          {/* Gráfico mensual + torta métodos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-5 lg:col-span-2">
              <ChartHeader
                title="Facturado vs Cobrado mensual"
                subtitle="Comparativa de ventas y cobranza por mes"
                icon={TrendingUp}
              />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlySeries}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="opacity-30"
                    />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) =>
                        v >= 1_000_000
                          ? `${(v / 1_000_000).toFixed(1)}M`
                          : v >= 1_000
                            ? `${(v / 1_000).toFixed(0)}k`
                            : String(v)
                      }
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v) => ARS.format(Number(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="billed"
                      name="Facturado"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="collected"
                      name="Cobrado"
                      fill="#22c55e"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <ChartHeader
                title="Por método de pago"
                subtitle="Distribución de cobros recibidos"
                icon={Wallet}
              />
              {byMethodChart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Wallet className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground italic">
                    Sin pagos registrados
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={byMethodChart}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={30}
                          outerRadius={65}
                          paddingAngle={2}
                        >
                          {byMethodChart.map((e) => (
                            <Cell key={e.name} fill={e.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          formatter={(v) => ARS.format(Number(v))}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1 text-xs">
                    {byMethodChart.map((m) => (
                      <div key={m.name} className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: m.color }}
                        />
                        <span className="flex-1">{m.name}</span>
                        <span className="font-mono">{ARS.format(m.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Tabla principal + top clientes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Presupuestos aceptados</h3>
                  <p className="text-xs text-muted-foreground">
                    {data.items.length} registros en el período filtrado
                  </p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Aceptado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Cobrado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-10 text-sm text-muted-foreground"
                      >
                        Sin presupuestos aceptados en este período.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.items.map((i) => {
                    const st = PAYMENT_STATUS_LABELS[i.status];
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-sm">
                          #{i.number}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {i.customerName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {i.customerEmail}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Car className="h-3 w-3 text-muted-foreground" />
                            {i.vehicleBrand} {i.vehicleModel}
                          </div>
                          <div className="text-xs font-mono text-muted-foreground">
                            {i.vehicleDomain}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {i.acceptedAt
                            ? new Date(i.acceptedAt).toLocaleDateString("es-AR")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {ARS.format(i.grandTotal)}
                        </TableCell>
                        <TableCell className="text-right text-green-700">
                          {ARS.format(i.paid)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${i.balance > 0 ? "text-red-600" : "text-muted-foreground"}`}
                        >
                          {ARS.format(i.balance)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={st.color}>
                            {st.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => setPaymentsTarget(i)}
                          >
                            <Wallet className="h-4 w-4" />
                            {i.paymentsCount > 0
                              ? `${i.paymentsCount} pagos`
                              : "Registrar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            <Card className="p-5">
              <ChartHeader
                title="Top clientes"
                subtitle="Por monto cobrado en el período"
                icon={Trophy}
              />
              {data.topCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Trophy className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground italic">
                    Sin clientes con pagos registrados
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Cobrado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topCustomers.map((c, i) => (
                      <TableRow key={c.email}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-xs w-6 h-6 p-0 flex items-center justify-center font-mono"
                            >
                              {i + 1}
                            </Badge>
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">
                                {c.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {c.count}{" "}
                                {c.count === 1 ? "presupuesto" : "presupuestos"}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {ARS.format(c.paid)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Dialog de pagos */}
      <Dialog
        open={!!paymentsTarget}
        onOpenChange={(v) => {
          if (!v) setPaymentsTarget(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#003b73]" />
              Pagos · Presupuesto #{paymentsTarget?.number}
            </DialogTitle>
            <DialogDescription>
              {paymentsTarget && (
                <>
                  <b>{paymentsTarget.customerName}</b> ·{" "}
                  {paymentsTarget.vehicleBrand} {paymentsTarget.vehicleModel}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {paymentsTarget && (
            <div className="space-y-5">
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="font-semibold text-lg">
                    {ARS.format(paymentsTarget.grandTotal)}
                  </div>
                </div>
                <div className="rounded-md border p-3 bg-green-500/5">
                  <div className="text-xs text-muted-foreground">Cobrado</div>
                  <div className="font-semibold text-lg text-green-700">
                    {ARS.format(paymentsTarget.paid)}
                  </div>
                </div>
                <div
                  className={`rounded-md border p-3 ${paymentsTarget.balance > 0 ? "bg-red-500/5" : "bg-muted/30"}`}
                >
                  <div className="text-xs text-muted-foreground">Saldo</div>
                  <div
                    className={`font-semibold text-lg ${paymentsTarget.balance > 0 ? "text-red-600" : "text-muted-foreground"}`}
                  >
                    {ARS.format(paymentsTarget.balance)}
                  </div>
                </div>
              </div>

              {/* Formulario nuevo pago */}
              {paymentsTarget.balance > 0 && (
                <Card className="p-4 space-y-3 bg-muted/20">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Registrar nuevo pago
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="payAmount" className="text-xs">
                        Monto
                      </Label>
                      <Input
                        id="payAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={String(paymentsTarget.balance)}
                        value={addForm.amount}
                        onChange={(e) =>
                          setAddForm((f) => ({ ...f, amount: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setAddForm((f) => ({
                            ...f,
                            amount: String(paymentsTarget.balance),
                          }))
                        }
                        className="text-xs text-primary hover:underline text-left"
                      >
                        Cancelar saldo ({ARS.format(paymentsTarget.balance)})
                      </button>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="payDate" className="text-xs">
                        Fecha
                      </Label>
                      <Input
                        id="payDate"
                        type="date"
                        value={addForm.paidAt}
                        onChange={(e) =>
                          setAddForm((f) => ({ ...f, paidAt: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Método</Label>
                      <Select
                        value={addForm.method}
                        onValueChange={(v) =>
                          setAddForm((f) => ({
                            ...f,
                            method: v as PaymentMethod,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.key} value={m.key}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="payRef" className="text-xs">
                      Referencia (opcional)
                    </Label>
                    <Input
                      id="payRef"
                      placeholder="Nº de transferencia, cheque, ticket MP…"
                      value={addForm.reference}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, reference: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="payNotes" className="text-xs">
                      Notas (opcional)
                    </Label>
                    <Textarea
                      id="payNotes"
                      rows={2}
                      value={addForm.notes}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, notes: e.target.value }))
                      }
                    />
                  </div>
                  {addError && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{" "}
                      <span>{addError}</span>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button
                      onClick={submitPayment}
                      disabled={addBusy}
                      className="gap-2"
                    >
                      {addBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />{" "}
                          Registrando…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Registrar pago
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Historial */}
              <div>
                <h4 className="font-semibold text-sm mb-2">
                  Historial de pagos
                </h4>
                {paymentsLoading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 inline animate-spin mr-2" />{" "}
                    Cargando…
                  </div>
                ) : payments.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground italic">
                    Sin pagos registrados.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">Fecha</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Referencia</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="w-16" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => {
                        const mm = PAYMENT_METHOD_BY_KEY[p.method];
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs">
                              <Calendar className="h-3 w-3 inline mr-1 text-muted-foreground" />
                              {new Date(p.paidAt).toLocaleDateString("es-AR")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={mm?.color}>
                                {mm?.label ?? p.method}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {p.reference ?? "—"}
                              {p.notes && (
                                <div className="italic">{p.notes}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {ARS_PRECISE.format(Number(p.amount))}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive"
                                onClick={() => deletePayment(p.id)}
                              >
                                ×
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentsTarget(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function methodColor(m: PaymentMethod): string {
  const map: Record<PaymentMethod, string> = {
    EFECTIVO: "#22c55e",
    TRANSFERENCIA: "#3b82f6",
    CHEQUE: "#64748b",
    TARJETA: "#a855f7",
    MERCADOPAGO: "#06b6d4",
    OTRO: "#94a3b8",
  };
  return map[m];
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: "blue" | "green" | "red" | "purple" | "cyan" | "orange";
}) {
  const palette: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    red: "bg-red-500/10 text-red-500",
    purple: "bg-purple-500/10 text-purple-500",
    cyan: "bg-cyan-500/10 text-cyan-500",
    orange: "bg-orange-500/10 text-orange-500",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold truncate">{value}</p>
        </div>
        <div
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${palette[color]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function ChartHeader({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-2 pb-3 mb-3 border-b">
      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
