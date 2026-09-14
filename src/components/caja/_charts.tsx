"use client";

/**
 * Perf audit · recharts lazy — el chart de "Ingresos mes a mes" se carga
 * on-demand desde caja-section vía next/dynamic.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ARS_FMT = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function CajaIngresosChart({
  data,
}: {
  data: Array<{ month: string; ingresos: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorCajaIngresos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#003b73" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#003b73" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
          formatter={(v) => ARS_FMT.format(Number(v ?? 0))}
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
  );
}
