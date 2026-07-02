"use client";

import {
  Building2,
  Car,
  CheckCircle2,
  FileText,
  Loader2,
  LogOut,
  RefreshCw,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InsuranceBucket =
  | "NORTE"
  | "SANCOR"
  | "SAN_CRIST"
  | "OTROS"
  | "PARTICULARES";

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
  porCompania: {
    month: string;
    total: number;
    accepted: number;
    byInsurance: Array<{
      key: InsuranceBucket;
      total: number;
      accepted: number;
    }>;
  };
  egresos: {
    month: string;
    total: number;
    list: Array<{
      id: string;
      internalNumber: number | null;
      customerName: string;
      vehicle: string;
      domain: string;
      insurance: string | null;
      deliveredAt: string;
    }>;
  };
};

const INSURANCE_LABEL: Record<InsuranceBucket, string> = {
  NORTE: "Norte",
  SANCOR: "Sancor",
  SAN_CRIST: "San Cristóbal",
  OTROS: "Otros seguros",
  PARTICULARES: "Particulares",
};

const INSURANCE_DOT: Record<InsuranceBucket, string> = {
  NORTE: "bg-blue-500",
  SANCOR: "bg-orange-500",
  SAN_CRIST: "bg-emerald-500",
  OTROS: "bg-slate-400",
  PARTICULARES: "bg-violet-500",
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
  // Mes seleccionado para el bloque "Por compañía". El default es el mes
  // actual; el resto del payload (cotizaciones / producción) usa el mismo
  // mes para que los counters mensuales coincidan con la vista.
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Últimos 12 meses como opciones del selector.
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const value = `${y}-${String(m).padStart(2, "0")}`;
      const label = d.toLocaleDateString("es-AR", {
        month: "long",
        year: "numeric",
      });
      return { value, label: label[0].toUpperCase() + label.slice(1) };
    });
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stats?month=${selectedMonth}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as StatsResponse;
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Estadísticas mensuales
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cotizaciones, producción y desglose por compañía de seguro
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Recargar
          </Button>
        </div>
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
        <>
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

          {/* ───────── Por compañía (mensual) ───────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  Presupuestos del mes por compañía
                </h2>
                <p className="text-xs text-slate-500">
                  Snapshot del mes seleccionado · ampliaciones excluidas
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <KpiBox
                label="Presupuestos del mes"
                value={INT.format(data.porCompania.total)}
              />
              <KpiBox
                label="Aprobados"
                value={INT.format(data.porCompania.accepted)}
                accent="text-emerald-600"
                icon={CheckCircle2}
              />
              <KpiBox
                label="% Aprobación"
                value={
                  data.porCompania.total > 0
                    ? `${Math.round(
                        (data.porCompania.accepted / data.porCompania.total) *
                          100,
                      )}%`
                    : "—"
                }
                hint={`${data.porCompania.accepted} de ${data.porCompania.total}`}
              />
            </div>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">
                  Detalle por compañía
                </h3>
              </div>
              <ul className="space-y-2.5">
                {data.porCompania.byInsurance.map((b) => {
                  const rate =
                    b.total > 0
                      ? Math.round((b.accepted / b.total) * 100)
                      : 0;
                  return (
                    <li key={b.key} className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${INSURANCE_DOT[b.key]}`}
                        />
                        <span className="text-sm text-slate-800 font-medium w-44 shrink-0">
                          {INSURANCE_LABEL[b.key]}
                        </span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${INSURANCE_DOT[b.key]} transition-all`}
                            style={{
                              width: `${data.porCompania.total > 0 ? (b.total / data.porCompania.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-slate-900 w-10 text-right shrink-0">
                          {b.total}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 pl-6.5">
                        <span className="text-[11px] text-slate-500 w-44 shrink-0">
                          Aprobados
                        </span>
                        <div className="flex-1" />
                        <span className="text-[11px] tabular-nums text-emerald-700 font-medium">
                          {b.accepted}{" "}
                          <span className="text-slate-400 font-normal">
                            ({rate}%)
                          </span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>

          {/* ───────── Egresos del mes ─────────
              Autos que salieron del taller en el mes seleccionado (usa
              deliveredAt). Sirve para reportar rendimiento operativo y
              compartir la lista con el cliente/compañía cuando pide corte. */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-sky-50 flex items-center justify-center">
                <LogOut className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Egresos del mes</h2>
                <p className="text-xs text-slate-500">
                  Vehículos entregados al cliente (fecha real de egreso)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <KpiBox
                label="Autos egresados"
                value={INT.format(data.egresos.total)}
                icon={Car}
              />
            </div>

            <Card className="p-0 overflow-hidden">
              {data.egresos.list.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 italic">
                  No hubo egresos en este mes.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700 w-24">
                          Fecha
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700 w-14">
                          Nº
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">
                          Cliente
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">
                          Vehículo
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700 w-24">
                          Dominio
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700 w-40">
                          Compañía
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.egresos.list.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-3 py-2 text-slate-700 tabular-nums">
                            {new Date(r.deliveredAt).toLocaleDateString(
                              "es-AR",
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500 font-mono">
                            {r.internalNumber ?? "—"}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {r.customerName}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {r.vehicle}
                          </td>
                          <td className="px-3 py-2 text-slate-700 font-mono uppercase">
                            {r.domain}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {r.insurance ?? (
                              <span className="italic text-slate-400">
                                Particular
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </section>
        </>
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
