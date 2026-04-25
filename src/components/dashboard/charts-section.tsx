"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ChartsData = {
  revenue: Array<{ month: string; ingresos: number }>;
  services: Array<{ servicio: string; cantidad: number }>;
  vehicles: Array<{ dia: string; vehiculos: number }>;
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function ChartsSection() {
  const [data, setData] = useState<ChartsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

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
        {[4, 3, 7].map((span) => (
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      <Card className="lg:col-span-4 hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Ingresos</CardTitle>
          <CardDescription>Cobros por mes (últimos 6 meses)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-75 min-h-75 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenue}>
                <defs>
                  <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#003b73" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#003b73" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
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
                  fill="url(#colorIngresos)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 hover:shadow-md transition-shadow">
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.services} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    dataKey="servicio"
                    type="category"
                    stroke="hsl(var(--muted-foreground))"
                    width={140}
                    fontSize={11}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="cantidad" fill="#003b73" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-7 hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Flujo de Vehículos</CardTitle>
          <CardDescription>Vehículos ingresados por día (últimos 7 días)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-50 min-h-50 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.vehicles}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line
                  type="monotone"
                  dataKey="vehiculos"
                  stroke="#003b73"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
