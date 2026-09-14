"use client";

import {
  Activity,
  BarChart3,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  Info,
  Layers,
  Loader2,
  Package,
  RefreshCw,
  Ruler,
  TrendingUp,
  Wrench,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

// Perf audit: recharts lazy — solo carga cuando aparecen los gráficos.
const chartFallback = (
  <div className="h-full flex items-center justify-center text-slate-400">
    <Loader2 className="h-4 w-4 animate-spin" />
  </div>
);
const TopCategoriesChart = dynamic(
  () => import("./_services-charts").then((m) => m.TopCategoriesChart),
  { ssr: false, loading: () => chartFallback },
);
const LaborVsPartsPie = dynamic(
  () => import("./_services-charts").then((m) => m.LaborVsPartsPie),
  { ssr: false, loading: () => chartFallback },
);
const MonthlyByTypeChart = dynamic(
  () => import("./_services-charts").then((m) => m.MonthlyByTypeChart),
  { ssr: false, loading: () => chartFallback },
);
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { CATEGORY_BY_KEY } from "@/lib/budget-catalog";
import type {
  ConceptCategory,
  ConceptType,
} from "../../../generated/prisma/client";

type CategoryRow = {
  key: ConceptCategory;
  type: ConceptType;
  count: number;
  totalAmount: number;
  avgAmount: number;
  avgUnits: number | null;
  avgUnitValue: number | null;
};

type ServicesResponse = {
  period: { from: string; to: string; scope: "accepted" | "all" };
  kpis: {
    totalLaborAmount: number;
    totalPartsAmount: number;
    laborShare: number;
    topCategoryKey: ConceptCategory | null;
    topCategoryAmount: number;
    avgTicketMO: number;
    budgetCount: number;
    conceptCount: number;
    partsCount: number;
  };
  byCategory: CategoryRow[];
  byType: Record<ConceptType, { count: number; amount: number }>;
  monthlyByType: Array<{
    month: string;
    label: string;
    DESCRIPTIVO: number;
    UNIDADES: number;
    FIJO: number;
    partsAmount: number;
  }>;
  topCategories: CategoryRow[];
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const INT = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

const TYPE_LABEL: Record<ConceptType, string> = {
  DESCRIPTIVO: "Descriptivos",
  UNIDADES: "Por unidades",
  FIJO: "Importe fijo",
};

const TYPE_COLOR: Record<ConceptType, string> = {
  DESCRIPTIVO: "#64748b",
  UNIDADES: "#3b82f6",
  FIJO: "#22c55e",
};

const TYPE_BADGE: Record<ConceptType, string> = {
  DESCRIPTIVO: "bg-slate-500/10 text-slate-700 border-slate-200",
  UNIDADES: "bg-blue-500/10 text-blue-700 border-blue-200",
  FIJO: "bg-green-500/10 text-green-700 border-green-200",
};

export default function ServicesSection() {
  const [data, setData] = useState<ServicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"30d" | "90d" | "6m" | "12m">("6m");
  const [scope, setScope] = useState<"accepted" | "all">("accepted");

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
        scope,
      });
      const res = await fetch(`/api/reports/services?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as ServicesResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [period, scope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Datos derivados
  const topCategoriesChart = useMemo(() => {
    if (!data) return [];
    return data.topCategories.slice(0, 8).map((c) => ({
      name: CATEGORY_BY_KEY[c.key]?.label ?? c.key,
      value: c.totalAmount,
      type: c.type,
      color: TYPE_COLOR[c.type],
    }));
  }, [data]);

  const typeDistribution = useMemo(() => {
    if (!data) return [];
    return (
      Object.entries(data.byType) as Array<
        [ConceptType, { count: number; amount: number }]
      >
    )
      .filter(([, v]) => v.amount > 0 || v.count > 0)
      .map(([k, v]) => ({
        name: TYPE_LABEL[k],
        value: v.amount,
        count: v.count,
        color: TYPE_COLOR[k],
      }));
  }, [data]);

  const laborVsPartsChart = useMemo(() => {
    if (!data) return [];
    const mo = data.kpis.totalLaborAmount;
    const rp = data.kpis.totalPartsAmount;
    if (mo === 0 && rp === 0) return [];
    return [
      { name: "Mano de obra", value: mo, color: "#003b73" },
      { name: "Repuestos", value: rp, color: "#f97316" },
    ];
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: "Reportes" }, { label: "Servicios" }]} />
        <h1 className="text-3xl font-bold">Reportes — Servicios</h1>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="grid grid-cols-2 md:flex md:items-center gap-3 flex-1">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Período</Label>
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as typeof period)}
              >
                <SelectTrigger className="w-48">
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
              <Label className="text-xs text-muted-foreground">Alcance</Label>
              <Select
                value={scope}
                onValueChange={(v) => setScope(v as typeof scope)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accepted">
                    Solo aceptados (facturado)
                  </SelectItem>
                  <SelectItem value="all">Todos (cotizado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>
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
          servicios…
        </Card>
      )}

      {data && (
        <>
          {/* Info banner explicativo del scope */}
          <Card className="p-3 bg-muted/30 border-primary/20">
            <div className="flex items-start gap-2 text-xs">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-muted-foreground">
                {scope === "accepted" ? (
                  <>
                    Mostrando datos de <b>presupuestos aceptados</b> (lo que
                    facturaste realmente). Cambiá a "Todos" para ver qué cotizás
                    más allá de si cerraste.
                  </>
                ) : (
                  <>
                    Mostrando <b>todos los presupuestos</b> del período. Útil
                    para ver la demanda real; filtrá a "Solo aceptados" para
                    facturación real.
                  </>
                )}
              </span>
            </div>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard
              label="Mano de obra"
              value={ARS.format(data.kpis.totalLaborAmount)}
              icon={Wrench}
              color="blue"
            />
            <KpiCard
              label="Repuestos"
              value={ARS.format(data.kpis.totalPartsAmount)}
              icon={Package}
              color="orange"
            />
            <KpiCard
              label="% MO"
              value={`${data.kpis.laborShare}%`}
              icon={BarChart3}
              color="purple"
            />
            <KpiCard
              label="Top categoría"
              value={
                data.kpis.topCategoryKey
                  ? (CATEGORY_BY_KEY[data.kpis.topCategoryKey]?.label ?? "—")
                  : "—"
              }
              icon={TrendingUp}
              color="green"
            />
            <KpiCard
              label="Ticket MO prom."
              value={ARS.format(data.kpis.avgTicketMO)}
              icon={DollarSign}
              color="cyan"
            />
            <KpiCard
              label="Conceptos"
              value={INT.format(data.kpis.conceptCount)}
              icon={Layers}
              color="indigo"
            />
          </div>

          {/* Gráficos principales */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-5 lg:col-span-2">
              <ChartHeader
                title="Ranking por categoría"
                subtitle="Monto total de mano de obra por tipo de servicio (top 8)"
                icon={BarChart3}
              />
              {topCategoriesChart.length === 0 ? (
                <EmptyMini text="Sin conceptos que facturan (DESCRIPTIVO no suma)" />
              ) : (
                <div className="h-72">
                  <TopCategoriesChart data={topCategoriesChart} />
                </div>
              )}
            </Card>

            <Card className="p-5">
              <ChartHeader
                title="MO vs Repuestos"
                subtitle="Composición total del facturado"
                icon={Activity}
              />
              {laborVsPartsChart.length === 0 ? (
                <EmptyMini text="Sin datos" />
              ) : (
                <div className="space-y-3">
                  <div className="h-44">
                    <LaborVsPartsPie data={laborVsPartsChart} />
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {laborVsPartsChart.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: d.color }}
                        />
                        <span className="flex-1">{d.name}</span>
                        <span className="font-mono text-xs">
                          {ARS.format(d.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Distribución por tipo de concepto + evolución mensual */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-5">
              <ChartHeader
                title="Distribución por tipo"
                subtitle="Cómo se reparten los conceptos"
                icon={Layers}
              />
              {typeDistribution.length === 0 ? (
                <EmptyMini text="Sin conceptos" />
              ) : (
                <div className="space-y-2">
                  {typeDistribution.map((t) => (
                    <div key={t.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{t.name}</span>
                        <span className="text-muted-foreground">
                          {t.count} concepto{t.count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              background: t.color,
                              width:
                                data.kpis.totalLaborAmount === 0
                                  ? 0
                                  : `${(t.value / data.kpis.totalLaborAmount) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono min-w-[5rem] text-right">
                          {ARS.format(t.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-4 pt-3 border-t">
                Los conceptos <b>descriptivos</b> (desmontajes, desabollado,
                bancada) no suman importe directo — se facturan bajo
                chapa/pintura/fijos.
              </p>
            </Card>

            <Card className="p-5 lg:col-span-2">
              <ChartHeader
                title="Evolución mensual por tipo"
                subtitle="MO Unidades (chapa/pintura), MO Fija (mecánica/etc) y Repuestos"
                icon={TrendingUp}
              />
              <div className="h-64">
                <MonthlyByTypeChart
                  data={data.monthlyByType}
                  typeColor={TYPE_COLOR}
                />
              </div>
            </Card>
          </div>

          {/* Tabla detallada */}
          <Card>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Detalle por categoría</h3>
                <p className="text-xs text-muted-foreground">
                  Ordenado por monto. Las descriptivas aparecen con $0 porque no
                  suman importe directo.
                </p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cotizaciones</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Promedio</TableHead>
                  <TableHead className="text-right">Unidades prom.</TableHead>
                  <TableHead className="text-right">
                    Valor unit. prom.
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byCategory.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-10 text-sm text-muted-foreground"
                    >
                      Sin conceptos en este período.
                    </TableCell>
                  </TableRow>
                )}
                {data.byCategory.map((c) => {
                  const def = CATEGORY_BY_KEY[c.key];
                  return (
                    <TableRow key={c.key}>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {def?.label ?? c.key}
                        </div>
                        {def?.hint && (
                          <div className="text-xs text-muted-foreground">
                            {def.hint}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={TYPE_BADGE[c.type]}>
                          {TYPE_LABEL[c.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {c.count}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {ARS.format(c.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {ARS.format(c.avgAmount)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {c.avgUnits != null ? (
                          INT.format(c.avgUnits)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {c.avgUnitValue != null ? (
                          ARS.format(c.avgUnitValue)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
  color: "blue" | "orange" | "purple" | "green" | "cyan" | "indigo";
}) {
  const palette: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500",
    orange: "bg-orange-500/10 text-orange-500",
    purple: "bg-purple-500/10 text-purple-500",
    green: "bg-green-500/10 text-green-500",
    cyan: "bg-cyan-500/10 text-cyan-500",
    indigo: "bg-indigo-500/10 text-indigo-500",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-base font-bold truncate">{value}</p>
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
      <Ruler className="h-8 w-8 text-muted-foreground/30 mb-2" />
      <p className="text-xs text-muted-foreground italic">{text}</p>
    </div>
  );
}
