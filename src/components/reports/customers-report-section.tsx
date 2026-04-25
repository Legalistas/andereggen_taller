"use client";

import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Download,
  Loader2,
  Mail,
  Phone,
  PiggyBank,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

type Segment = "new" | "frequent" | "regular" | "at_risk" | "moroso";

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  dni: string | null;
  createdAt: string;
  vehicleCount: number;
  leadsTotal: number;
  leadsInRange: number;
  budgetsInRange: number;
  budgetCount: number;
  acceptedCount: number;
  conversionRate: number;
  totalBilled: number;
  totalCollected: number;
  pendingBalance: number;
  avgTicket: number;
  lastActivityAt: string | null;
  firstContactAt: string | null;
  segment: Segment;
};

type ReportResponse = {
  period: { from: string; to: string };
  kpis: {
    totalCustomers: number;
    activeTotal: number;
    newInPeriod: number;
    morosos: number;
    avgCLV: number;
    avgTicket: number;
  };
  customers: CustomerRow[];
  newByMonth: Array<{ month: string; label: string; newCount: number }>;
  topByBilled: CustomerRow[];
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const INT = new Intl.NumberFormat("es-AR");

const SEGMENT_CONFIG: Record<Segment, { label: string; color: string }> = {
  new: {
    label: "Nuevo",
    color: "bg-blue-500/10 text-blue-700 border-blue-200",
  },
  frequent: {
    label: "Frecuente",
    color: "bg-green-500/10 text-green-700 border-green-200",
  },
  regular: {
    label: "Regular",
    color: "bg-slate-500/10 text-slate-700 border-slate-200",
  },
  at_risk: {
    label: "En riesgo",
    color: "bg-orange-500/10 text-orange-700 border-orange-200",
  },
  moroso: {
    label: "Moroso",
    color: "bg-red-500/10 text-red-700 border-red-200",
  },
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 86400_000),
  );
}

export default function CustomersReportSection() {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"30d" | "90d" | "6m" | "12m">("6m");
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<"all" | Segment>("all");

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
      if (segment !== "all") params.set("segment", segment);
      const res = await fetch(`/api/reports/customers?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as ReportResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [period, search, segment]);

  useEffect(() => {
    const t = setTimeout(fetchData, 200);
    return () => clearTimeout(t);
  }, [fetchData]);

  const topChart = useMemo(() => {
    if (!data) return [];
    return data.topByBilled.map((c) => ({
      name: c.name.length > 22 ? c.name.slice(0, 22) + "…" : c.name,
      value: c.totalBilled,
    }));
  }, [data]);

  const exportCsv = () => {
    if (!data) return;
    const headers = [
      "Cliente",
      "Email",
      "Telefono",
      "Segmento",
      "Vehiculos",
      "Cotizaciones",
      "Presupuestos",
      "Aceptados",
      "Conversion %",
      "Facturado",
      "Cobrado",
      "Saldo",
      "Ticket prom",
      "Ultima actividad",
    ];
    const rows = data.customers.map((c) =>
      [
        JSON.stringify(c.name),
        c.email,
        c.phone,
        SEGMENT_CONFIG[c.segment].label,
        c.vehicleCount,
        c.leadsTotal,
        c.budgetCount,
        c.acceptedCount,
        c.conversionRate,
        c.totalBilled,
        c.totalCollected,
        c.pendingBalance,
        Math.round(c.avgTicket),
        c.lastActivityAt
          ? new Date(c.lastActivityAt).toLocaleDateString("es-AR")
          : "",
      ].join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Reportes" }, { label: "Clientes" }]} />
        <h1 className="text-3xl font-bold">Reportes — Clientes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ranking, segmentación y valor de cada cliente (CLV). Detectá morosos,
          frecuentes y clientes en riesgo de no volver.
        </p>
      </div>

      {/* Filtros */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <Input
            placeholder="Buscar por nombre, email, teléfono o DNI..."
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
            <Label className="text-xs text-muted-foreground">Segmento</Label>
            <Select
              value={segment}
              onValueChange={(v) => setSegment(v as typeof segment)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los segmentos</SelectItem>
                <SelectItem value="new">Nuevos</SelectItem>
                <SelectItem value="frequent">Frecuentes</SelectItem>
                <SelectItem value="regular">Regulares</SelectItem>
                <SelectItem value="at_risk">En riesgo</SelectItem>
                <SelectItem value="moroso">Morosos</SelectItem>
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
          reporte…
        </Card>
      )}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard
              label="Total"
              value={INT.format(data.kpis.totalCustomers)}
              icon={Users}
              color="blue"
            />
            <KpiCard
              label="Activos (periodo)"
              value={INT.format(data.kpis.activeTotal)}
              icon={Sparkles}
              color="cyan"
            />
            <KpiCard
              label="Nuevos"
              value={INT.format(data.kpis.newInPeriod)}
              icon={UserPlus}
              color="green"
            />
            <KpiCard
              label="Morosos"
              value={INT.format(data.kpis.morosos)}
              icon={AlertTriangle}
              color="red"
            />
            <KpiCard
              label="CLV promedio"
              value={ARS.format(data.kpis.avgCLV)}
              icon={Trophy}
              color="purple"
            />
            <KpiCard
              label="Ticket prom."
              value={ARS.format(data.kpis.avgTicket)}
              icon={PiggyBank}
              color="orange"
            />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-5 lg:col-span-2">
              <ChartHeader
                title="Top 10 por facturación"
                subtitle="Clientes con más monto facturado en el período"
                icon={Trophy}
              />
              {topChart.length === 0 ? (
                <EmptyMini text="Sin clientes con facturación" />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topChart}
                      layout="vertical"
                      margin={{ left: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="opacity-30"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}M`
                            : v >= 1_000
                              ? `${(v / 1_000).toFixed(0)}k`
                              : String(v)
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        width={160}
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        formatter={(v) => ARS.format(Number(v))}
                      />
                      <Bar dataKey="value" fill="#003b73" radius={[0, 4, 4, 0]}>
                        {topChart.map((_, i) => (
                          <Cell key={i} fill="#003b73" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <ChartHeader
                title="Nuevos clientes por mes"
                subtitle="Captación en el período"
                icon={UserPlus}
              />
              {data.newByMonth.every((m) => m.newCount === 0) ? (
                <EmptyMini text="Sin clientes nuevos en el período" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.newByMonth}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="opacity-30"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar
                        dataKey="newCount"
                        fill="#22c55e"
                        radius={[4, 4, 0, 0]}
                        name="Nuevos"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* Tabla detallada */}
          <Card>
            <div className="p-4 border-b flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold">Listado de clientes</h3>
                <p className="text-xs text-muted-foreground">
                  {data.customers.length}{" "}
                  {data.customers.length === 1 ? "cliente" : "clientes"} con
                  actividad en el período
                </p>
              </div>
              <div className="flex gap-1">
                {(Object.keys(SEGMENT_CONFIG) as Segment[]).map((s) => {
                  const count = data.customers.filter(
                    (c) => c.segment === s,
                  ).length;
                  if (count === 0) return null;
                  return (
                    <Badge
                      key={s}
                      variant="outline"
                      className={`${SEGMENT_CONFIG[s].color} gap-1`}
                    >
                      {SEGMENT_CONFIG[s].label}
                      <span className="text-[10px] opacity-80">{count}</span>
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead className="text-right">
                      Cotiz. / Preps
                    </TableHead>
                    <TableHead className="text-right">Conversión</TableHead>
                    <TableHead className="text-right">Facturado</TableHead>
                    <TableHead className="text-right">Cobrado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Ticket prom.</TableHead>
                    <TableHead>Última</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.customers.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-10 text-sm text-muted-foreground"
                      >
                        Sin clientes para este filtro.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.customers.map((c) => {
                    const seg = SEGMENT_CONFIG[c.segment];
                    const days = daysSince(c.lastActivityAt);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {c.email}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {c.phone}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={seg.color}>
                            {seg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span className="font-medium">{c.leadsTotal}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            / {c.budgetCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span
                            className={
                              c.conversionRate >= 50
                                ? "text-green-600 font-medium"
                                : c.conversionRate > 0
                                  ? ""
                                  : "text-muted-foreground"
                            }
                          >
                            {c.conversionRate}%
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {c.acceptedCount}/{c.budgetCount}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {ARS.format(c.totalBilled)}
                        </TableCell>
                        <TableCell className="text-right text-green-700">
                          {ARS.format(c.totalCollected)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${c.pendingBalance > 0 ? "text-red-600" : "text-muted-foreground"}`}
                        >
                          {ARS.format(c.pendingBalance)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {ARS.format(c.avgTicket)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {days === null ? (
                            <span className="italic">sin actividad</span>
                          ) : (
                            <>
                              <Calendar className="h-3 w-3 inline mr-1" />
                              hace {days} {days === 1 ? "día" : "días"}
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
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
  color: "blue" | "cyan" | "green" | "red" | "purple" | "orange";
}) {
  const palette: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500",
    cyan: "bg-cyan-500/10 text-cyan-500",
    green: "bg-green-500/10 text-green-500",
    red: "bg-red-500/10 text-red-500",
    purple: "bg-purple-500/10 text-purple-500",
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

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BarChart3 className="h-8 w-8 text-muted-foreground/30 mb-2" />
      <p className="text-xs text-muted-foreground italic">{text}</p>
    </div>
  );
}
