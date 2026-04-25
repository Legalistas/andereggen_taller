"use client";

import {
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type StatsResponse = {
  cotizaciones: {
    totalYear: number;
    totalMonth: number;
    byStage: Array<{ stage: string; count: number }>;
    conversionRate: number;
    won: number;
    lost: number;
    closedTotal: number;
  };
  produccion: {
    totalActive: number;
    byStage: Array<{ stage: string; count: number }>;
    completedThisMonth: number;
  };
};

const LEAD_LABEL: Record<string, string> = {
  solicitud: "Solicitud",
  control: "Control",
  enviado: "Enviado",
  refuerzo: "Refuerzo",
  pendientes_cobro: "Pendientes de Cobro",
  ganado: "Ganado",
  perdido: "Perdido",
};

const LEAD_DOT: Record<string, string> = {
  solicitud: "bg-slate-400",
  control: "bg-blue-500",
  enviado: "bg-cyan-500",
  refuerzo: "bg-purple-500",
  pendientes_cobro: "bg-amber-500",
  ganado: "bg-emerald-500",
  perdido: "bg-rose-500",
};

const REPAIR_LABEL: Record<string, string> = {
  turno_asignado: "Turno Asignado",
  pendientes_repuestos: "Pendientes de Repuestos",
  chapa: "Chapa",
  pintura: "Pintura",
  calidad: "Calidad",
  pendientes_cobro: "Pendientes de Cobro",
  experiencia_cliente: "Experiencia del Cliente",
};

const REPAIR_DOT: Record<string, string> = {
  turno_asignado: "bg-slate-500",
  pendientes_repuestos: "bg-amber-500",
  chapa: "bg-orange-500",
  pintura: "bg-purple-500",
  calidad: "bg-cyan-500",
  pendientes_cobro: "bg-amber-600",
  experiencia_cliente: "bg-emerald-500",
};

const INT = new Intl.NumberFormat("es-AR");

export default function StatsSection() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as StatsResponse;
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: "Estadísticas" }]} />
          <h1 className="text-3xl font-bold">Estadísticas</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Recargar
        </Button>
      </div>

      {error && (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <p className="text-sm text-destructive">No se pudo cargar: {error}</p>
        </Card>
      )}

      {loading && !data && (
        <Card className="p-12 flex items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Calculando…
        </Card>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ───────── Cotizaciones ───────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold">Cotizaciones</h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <KpiBox
                label="Este mes"
                value={INT.format(data.cotizaciones.totalMonth)}
              />
              <KpiBox
                label="Este año"
                value={INT.format(data.cotizaciones.totalYear)}
              />
              <KpiBox
                label="Conversión"
                value={`${data.cotizaciones.conversionRate}%`}
                hint={`${data.cotizaciones.won} de ${data.cotizaciones.closedTotal} cerradas`}
                accent={
                  data.cotizaciones.conversionRate >= 50
                    ? "text-emerald-600"
                    : "text-slate-900"
                }
              />
            </div>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">
                  Por etapa
                </h3>
              </div>
              <ul className="space-y-2">
                {data.cotizaciones.byStage.map((s) => (
                  <StageRow
                    key={s.stage}
                    label={LEAD_LABEL[s.stage] ?? s.stage}
                    dotClass={LEAD_DOT[s.stage] ?? "bg-slate-400"}
                    count={s.count}
                    total={data.cotizaciones.byStage.reduce(
                      (acc, x) => acc + x.count,
                      0,
                    )}
                  />
                ))}
              </ul>
            </Card>
          </section>

          {/* ───────── Producción ───────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center">
                <Wrench className="h-5 w-5 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold">Producción</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <KpiBox
                label="En taller ahora"
                value={INT.format(data.produccion.totalActive)}
                hint="Sin contar archivadas"
              />
              <KpiBox
                label="Cerradas este mes"
                value={INT.format(data.produccion.completedThisMonth)}
                accent="text-emerald-600"
                icon={CheckCircle2}
              />
            </div>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">
                  Por etapa (vehículos activos)
                </h3>
              </div>
              <ul className="space-y-2">
                {data.produccion.byStage.map((s) => (
                  <StageRow
                    key={s.stage}
                    label={REPAIR_LABEL[s.stage] ?? s.stage}
                    dotClass={REPAIR_DOT[s.stage] ?? "bg-slate-400"}
                    count={s.count}
                    total={data.produccion.totalActive}
                  />
                ))}
              </ul>
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}

function KpiBox({
  label,
  value,
  hint,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  icon?: typeof CheckCircle2;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">
          {label}
        </p>
      </div>
      <p className={`text-3xl font-bold tabular-nums ${accent ?? "text-slate-900"}`}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </Card>
  );
}

function StageRow({
  label,
  dotClass,
  count,
  total,
}: {
  label: string;
  dotClass: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <li className="flex items-center gap-3">
      <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
      <span className="text-sm text-slate-700 w-44 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${dotClass} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums text-slate-900 w-10 text-right shrink-0">
        {count}
      </span>
    </li>
  );
}
