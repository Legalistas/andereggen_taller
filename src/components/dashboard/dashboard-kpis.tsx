"use client";

import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

type Stats = {
  vehiclesInRepair: {
    total: number;
    breakdown: { not_started: number; in_progress: number; ready: number };
  };
  budgetsInProgress: {
    total: number;
    drafts: number;
    pendingApproval: number;
  };
  completedThisMonth: { count: number; amount: number };
  avgRepairDays: number | null;
  conversionRate: { rate: number; won: number; total: number };
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function DashboardKpis() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/dashboard/stats", { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as Stats;
      })
      .then(setStats)
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Error");
        }
      });
    return () => ac.abort();
  }, []);

  if (error) {
    return (
      <Card className="p-4 border-rose-200 bg-rose-50 text-sm text-rose-700">
        No se pudieron cargar los KPIs: {error}
      </Card>
    );
  }

  if (!stats) return <KpisSkeleton />;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {/* 1. Vehículos en reparación */}
      <KpiCard
        icon={Wrench}
        iconColor="text-[#003b73]"
        iconBg="bg-[#003b73]/10"
        label="Vehículos en taller"
        value={String(stats.vehiclesInRepair.total)}
        footer={
          <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              {stats.vehiclesInRepair.breakdown.not_started} sin iniciar
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {stats.vehiclesInRepair.breakdown.in_progress} en proceso
            </span>
          </div>
        }
      />

      {/* 2. Cotizaciones en curso */}
      <KpiCard
        icon={FileText}
        iconColor="text-indigo-600"
        iconBg="bg-indigo-50"
        label="Cotizaciones en curso"
        value={String(stats.budgetsInProgress.total)}
        footer={
          <p className="text-[11px] text-slate-500">
            {stats.budgetsInProgress.pendingApproval} pendientes de aprobación ·{" "}
            {stats.budgetsInProgress.drafts} borradores
          </p>
        }
      />

      {/* 3. Reparaciones completadas en el mes */}
      <KpiCard
        icon={CheckCircle2}
        iconColor="text-emerald-600"
        iconBg="bg-emerald-50"
        label="Completadas este mes"
        value={String(stats.completedThisMonth.count)}
        footer={
          <p className="text-[11px] text-slate-500">
            {currency.format(stats.completedThisMonth.amount)} facturado
          </p>
        }
      />

      {/* 4. Tiempo promedio de reparación */}
      <KpiCard
        icon={Clock}
        iconColor="text-amber-600"
        iconBg="bg-amber-50"
        label="Tiempo promedio"
        value={
          stats.avgRepairDays === null
            ? "—"
            : `${stats.avgRepairDays.toFixed(1)} d`
        }
        footer={
          <p className="text-[11px] text-slate-500">
            {stats.avgRepairDays === null
              ? "Sin reparaciones completadas aún"
              : "Días desde aceptación a entrega"}
          </p>
        }
      />

      {/* 5. Tasa de conversión */}
      <KpiCard
        icon={TrendingUp}
        iconColor="text-rose-600"
        iconBg="bg-rose-50"
        label="Tasa de conversión"
        value={`${stats.conversionRate.rate}%`}
        footer={
          <p className="text-[11px] text-slate-500">
            {stats.conversionRate.won} ganadas de {stats.conversionRate.total}
          </p>
        }
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  footer,
}: {
  icon: typeof Wrench;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3 mb-4">
        <div className={`${iconBg} p-2.5 rounded-lg shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900 mb-1 tabular-nums leading-none">
        {value}
      </p>
      <p className="text-sm text-slate-500 mb-2">{label}</p>
      {footer}
    </Card>
  );
}

function KpisSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
          key={i}
          className="p-5 flex items-center justify-center min-h-32 text-slate-400"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
        </Card>
      ))}
    </div>
  );
}
