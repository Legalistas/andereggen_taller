"use client";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Perf audit: recharts lazy — no baja al cliente hasta que hay data.
const chartFallback = (
  <div className="h-full flex items-center justify-center text-slate-400">
    <Loader2 className="h-4 w-4 animate-spin" />
  </div>
);
const ServicesChart = dynamic(
  () => import("./_charts").then((m) => m.ServicesChart),
  { ssr: false, loading: () => chartFallback },
);
const VehiclesFlowChart = dynamic(
  () => import("./_charts").then((m) => m.VehiclesFlowChart),
  { ssr: false, loading: () => chartFallback },
);

type ChartsData = {
  services: Array<{ servicio: string; cantidad: number }>;
  vehicles: Array<{ mes: string; vehiculos: number }>;
};

export default function ChartsSection({
  initialData,
}: {
  initialData?: ChartsData;
} = {}) {
  const [data, setData] = useState<ChartsData | null>(initialData ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) return;
    const ac = new AbortController();
    fetch("/api/dashboard/charts", { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as ChartsData;
      })
      .then(setData)
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Error");
        }
      });
    return () => ac.abort();
  }, [initialData]);

  if (error) {
    return (
      <Card className="p-4 border-rose-200 bg-rose-50 text-sm text-rose-700">
        No se pudieron cargar los gráficos: {error}
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {[4, 7].map((span) => (
          <Card
            key={span}
            className={`lg:col-span-${span} p-8 flex items-center justify-center min-h-75 text-slate-400`}
          >
            <Loader2 className="h-5 w-5 animate-spin" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    // spec 3.3 / T16 v2 · El gráfico "Ingresos" se mudó al módulo Caja.
    // Acá dejamos Servicios y Flujo de Vehículos.
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      <Card className="lg:col-span-4 hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Servicios Más Solicitados</CardTitle>
          <CardDescription>Top 5 conceptos en presupuestos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-75 min-h-75 w-full">
            {data.services.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 italic">
                Aún no hay conceptos cargados
              </div>
            ) : (
              <ServicesChart data={data.services} />
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-7 hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Flujo de Vehículos</CardTitle>
          <CardDescription>
            Vehículos ingresados por mes (últimos 6 meses)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-50 min-h-50 w-full">
            <VehiclesFlowChart data={data.vehicles} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
