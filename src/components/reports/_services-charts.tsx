"use client";

/**
 * Perf audit · Charts lazy de services-section — recharts en su chunk.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

type BarItem = { name: string; value: number; color: string };

export function TopCategoriesChart({ data }: { data: BarItem[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          className="opacity-30"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) =>
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
          width={150}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v) => ARS.format(Number(v))}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((e) => (
            <Cell key={e.name} fill={e.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LaborVsPartsPie({ data }: { data: BarItem[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={40}
          outerRadius={75}
          paddingAngle={2}
        >
          {data.map((e) => (
            <Cell key={e.name} fill={e.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v) => ARS.format(Number(v))}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MonthlyByTypeChart({
  data,
  typeColor,
}: {
  data: Array<{
    label: string;
    UNIDADES: number;
    FIJO: number;
    partsAmount: number;
  }>;
  typeColor: { UNIDADES: string; FIJO: string };
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) =>
            v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
                ? `${(v / 1_000).toFixed(0)}k`
                : String(v)
          }
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v) => ARS.format(Number(v))}
        />
        <Line
          type="monotone"
          dataKey="UNIDADES"
          name="MO Unidades"
          stroke={typeColor.UNIDADES}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="FIJO"
          name="MO Fija"
          stroke={typeColor.FIJO}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="partsAmount"
          name="Repuestos"
          stroke="#f97316"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
