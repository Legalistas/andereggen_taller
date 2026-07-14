"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Loader2,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CollectionsTable from "./collections-table";
import GeneralPanel from "./general-panel";

/**
 * spec sección 4 v2 · Módulo Caja.
 * Header con KPIs (spec 4.4) + tabs:
 *   - Cobros por vehículo (spec 4.2)
 *   - Caja general — 5 cajas con movimientos + transferencias (spec 4.3)
 */

export type CashBoxSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  balance: number;
  month: {
    collections: number;
    ingresos: number;
    egresos: number;
    transfersIn: number;
    transfersOut: number;
  };
};

export type BoxesPayload = {
  month: string;
  boxes: CashBoxSummary[];
  totals: {
    balance: number;
    monthCollections: number;
    monthEgresos: number;
    monthBilling: number;
    pendingAmount: number;
    avgCollectionDaysPostDelivery: number | null;
  };
  byInsurance: Array<{ insurance: string; total: number }>;
  revenueSeries: Array<{ month: string; ingresos: number }>;
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function CajaSection() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [data, setData] = useState<BoxesPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthParam = `${year}-${String(month0 + 1).padStart(2, "0")}`;

  const fetchBoxes = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/caja/boxes?month=${monthParam}`, {
          signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as BoxesPayload;
        setData(payload);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Error");
        }
      } finally {
        setLoading(false);
      }
    },
    [monthParam],
  );

  useEffect(() => {
    const ac = new AbortController();
    fetchBoxes(ac.signal);
    return () => ac.abort();
  }, [fetchBoxes]);

  const prevMonth = () => {
    if (month0 === 0) {
      setYear((y) => y - 1);
      setMonth0(11);
    } else {
      setMonth0((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (month0 === 11) {
      setYear((y) => y + 1);
      setMonth0(0);
    } else {
      setMonth0((m) => m + 1);
    }
  };

  const totals = data?.totals;

  return (
    <div className="space-y-4">
      {/* Header con mes + KPIs */}
      <Card className="p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-40 text-center">
              <div className="text-lg font-semibold text-slate-900">
                {MONTH_LABELS[month0]} {year}
              </div>
              {loading && (
                <div className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-3 border-rose-200 bg-rose-50 text-sm text-rose-700">
          No se pudo cargar Caja: {error}
        </Card>
      )}

      {/* KPIs — spec 4.4 */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Wallet}
          iconTint="text-[#003b73]"
          iconBg="bg-[#003b73]/10"
          label="Saldo total"
          value={totals ? ARS.format(totals.balance) : "—"}
          hint="Consolidado de las 5 cajas"
        />
        <KpiCard
          icon={ArrowDownCircle}
          iconTint="text-emerald-600"
          iconBg="bg-emerald-50"
          label="Cobros del mes"
          value={totals ? ARS.format(totals.monthCollections) : "—"}
          hint={
            totals
              ? `Facturado: ${ARS.format(totals.monthBilling)}`
              : undefined
          }
        />
        <KpiCard
          icon={ArrowUpCircle}
          iconTint="text-rose-600"
          iconBg="bg-rose-50"
          label="Egresos del mes"
          value={totals ? ARS.format(totals.monthEgresos) : "—"}
          hint="Salidas registradas en todas las cajas"
        />
        <KpiCard
          icon={DollarSign}
          iconTint="text-amber-700"
          iconBg="bg-amber-50"
          label="Cobros pendientes"
          value={totals ? ARS.format(totals.pendingAmount) : "—"}
          hint={
            totals?.avgCollectionDaysPostDelivery !== null &&
            totals?.avgCollectionDaysPostDelivery !== undefined
              ? `Promedio ${Math.round(totals.avgCollectionDaysPostDelivery)} días post-entrega`
              : "Trabajos entregados sin cobro completo"
          }
        />
      </div>

      {/* spec 3.3 / T16 v2 · Gráfico de Ingresos — se mudó del dashboard
          general a Caja. Muestra los cobros de los últimos 6 meses. */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos</CardTitle>
          <CardDescription>Cobros por mes (últimos 6 meses)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-60 min-h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.revenueSeries ?? []}>
                <defs>
                  <linearGradient
                    id="colorCajaIngresos"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#003b73" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#003b73" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(v) => ARS.format(Number(v ?? 0))}
                />
                <Area
                  type="monotone"
                  dataKey="ingresos"
                  stroke="#003b73"
                  fill="url(#colorCajaIngresos)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Cobros / General */}
      <Tabs defaultValue="cobros" className="w-full">
        <TabsList>
          <TabsTrigger value="cobros">Cobros por vehículo</TabsTrigger>
          <TabsTrigger value="general">Caja general</TabsTrigger>
        </TabsList>
        <TabsContent value="cobros" className="mt-4">
          <CollectionsTable byInsurance={data?.byInsurance ?? []} />
        </TabsContent>
        <TabsContent value="general" className="mt-4">
          <GeneralPanel
            boxes={data?.boxes ?? []}
            monthParam={monthParam}
            onReload={() => fetchBoxes()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  iconTint,
  iconBg,
  label,
  value,
  hint,
}: {
  icon: typeof Wallet;
  iconTint: string;
  iconBg: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconTint}`} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            {label}
          </div>
          <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
            {value}
          </div>
          {hint && (
            <div className="text-[11px] text-slate-500 mt-1 truncate">
              {hint}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
