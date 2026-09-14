"use client";

/**
 * Perf audit · Wrappers de recharts extraídos a este archivo para poder
 * cargarse con `next/dynamic` desde el padre. Recharts pesa ~95 KB gz —
 * el usuario no lo baja hasta que aparecen los gráficos.
 */

import {
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

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
};
const labelStyle = { color: "hsl(var(--foreground))" };

export function ServicesChart({
  data,
}: {
  data: Array<{ servicio: string; cantidad: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis
          dataKey="servicio"
          type="category"
          stroke="hsl(var(--muted-foreground))"
          width={140}
          fontSize={11}
        />
        <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
        <Bar dataKey="cantidad" fill="#003b73" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VehiclesFlowChart({
  data,
}: {
  data: Array<{ mes: string; vehiculos: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="mes"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          allowDecimals={false}
        />
        <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
        <Line
          type="monotone"
          dataKey="vehiculos"
          stroke="#003b73"
          strokeWidth={3}
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
