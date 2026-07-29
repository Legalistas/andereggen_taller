"use client";

/**
 * KpiMatrix — tabla mensual consolidada del tablero de KPIs.
 *
 * spec KPIs jul '26 · Vista única con conceptos en filas agrupados por
 * subtítulos y meses en columnas. Al final: acumulado del año y VMA vs mes
 * anterior con semáforo verde/amarillo/rojo.
 *
 * Component "dumb": recibe los `groups` filtrados por permisos, la data
 * (`series` por metricKey) y una función `onEditManual` que dispara el
 * upsert. No hace fetch propio.
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type KpiGroup,
  type KpiMetric,
  type KpiValueType,
} from "@/lib/kpis/catalog";
import { computeVMA, pickCurrentAndPrevious, vmaSemaphore } from "@/lib/kpis/vma";
import { accumulateSeries, formatKpiValue, formatVma } from "./format";

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const SEMAPHORE_BG = {
  green: "bg-emerald-100 text-emerald-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-rose-100 text-rose-800",
  na: "bg-slate-100 text-slate-500",
} as const;

export type KpiMatrixProps = {
  year: number;
  groups: KpiGroup[];
  /** metricKey → array de 12 valores (ene-dic). Null en índices sin data. */
  series: Record<string, Array<number | null>>;
  /** Índice del mes "actual" (0-11) — resalta la columna y el VMA se calcula
   *  contra el mes anterior a este. Default: mes actual del año en curso. */
  currentMonthIndex: number;
  /** Callback para editar celdas manuales. */
  onEditManual?: (args: {
    metricKey: string;
    month: number; // 1-12
    value: number;
  }) => Promise<void>;
};

export default function KpiMatrix({
  year,
  groups,
  series,
  currentMonthIndex,
  onEditManual,
}: KpiMatrixProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="sticky left-0 z-10 bg-slate-900 text-left px-3 py-2 font-semibold uppercase tracking-wider text-[10px]">
              Métrica
            </th>
            <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] bg-slate-800">
              Acum. {year}
            </th>
            {MONTH_LABELS.map((m, i) => (
              <th
                key={m}
                className={`px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] ${
                  i === currentMonthIndex ? "bg-[#003b73]" : ""
                }`}
              >
                {m}
              </th>
            ))}
            <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] bg-slate-800">
              VMA
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRows
              key={group.key}
              group={group}
              series={series}
              currentMonthIndex={currentMonthIndex}
              onEditManual={onEditManual}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  group,
  series,
  currentMonthIndex,
  onEditManual,
}: {
  group: KpiGroup;
  series: KpiMatrixProps["series"];
  currentMonthIndex: number;
  onEditManual: KpiMatrixProps["onEditManual"];
}) {
  return (
    <>
      <tr>
        <th
          colSpan={15}
          className="text-left px-3 py-2 bg-[#3b6ba5] text-white text-[11px] uppercase tracking-wider font-semibold sticky left-0"
        >
          {group.title}
          <span className="ml-2 text-[10px] font-normal text-white/70 normal-case">
            · Responsable: {group.responsible}
          </span>
        </th>
      </tr>
      {group.subGroups.map((sub, subIdx) => (
        <SubGroupRows
          key={sub.title ?? `sub-${subIdx}`}
          title={sub.title}
          metrics={sub.metrics}
          series={series}
          currentMonthIndex={currentMonthIndex}
          onEditManual={onEditManual}
        />
      ))}
    </>
  );
}

function SubGroupRows({
  title,
  metrics,
  series,
  currentMonthIndex,
  onEditManual,
}: {
  title: string | undefined;
  metrics: KpiMetric[];
  series: KpiMatrixProps["series"];
  currentMonthIndex: number;
  onEditManual: KpiMatrixProps["onEditManual"];
}) {
  return (
    <>
      {title && (
        <tr>
          <th
            colSpan={15}
            className="text-left px-3 py-1.5 bg-[#dbe6f2] text-slate-800 text-[10px] uppercase tracking-wider font-semibold sticky left-0"
          >
            {title}
          </th>
        </tr>
      )}
      {metrics.map((metric) => (
        <DataRow
          key={metric.key}
          metric={metric}
          series={series[metric.key] ?? Array(12).fill(null)}
          currentMonthIndex={currentMonthIndex}
          onEditManual={onEditManual}
        />
      ))}
    </>
  );
}

function DataRow({
  metric,
  series,
  currentMonthIndex,
  onEditManual,
}: {
  metric: KpiMetric;
  series: Array<number | null>;
  currentMonthIndex: number;
  onEditManual: KpiMatrixProps["onEditManual"];
}) {
  const { current, previous } = pickCurrentAndPrevious(
    series,
    currentMonthIndex,
  );
  const vma = computeVMA(current, previous);
  const semaphore = vmaSemaphore(vma, { inverted: metric.inverted });
  const accumulated = accumulateSeries(series, metric.type);

  const isEditable = metric.source === "manual" && !!onEditManual;

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/60">
      <td className="sticky left-0 bg-white group-hover:bg-slate-50/60 px-3 py-1.5 text-slate-800">
        <div className="flex items-center gap-1.5">
          <span>{metric.label}</span>
          {metric.source === "manual" && (
            <span
              className="text-[9px] uppercase tracking-wider text-amber-700 bg-amber-100 px-1 rounded"
              title="Se carga a mano — click en una celda del mes para editar"
            >
              manual
            </span>
          )}
        </div>
        {metric.description && (
          <div className="text-[10px] text-slate-400 truncate max-w-96">
            {metric.description}
          </div>
        )}
      </td>
      <td className="px-2 py-1.5 text-right font-semibold text-slate-900 bg-slate-50">
        {formatKpiValue(accumulated, metric.type)}
      </td>
      {series.map((value, i) => {
        const isCurrent = i === currentMonthIndex;
        if (isEditable) {
          return (
            <EditableCell
              key={i}
              value={value}
              type={metric.type}
              highlighted={isCurrent}
              onSave={(v) =>
                onEditManual!({
                  metricKey: metric.key,
                  month: i + 1,
                  value: v,
                })
              }
            />
          );
        }
        return (
          <td
            key={i}
            className={`px-2 py-1.5 text-right ${
              isCurrent
                ? "bg-[#003b73]/5 font-semibold text-slate-900"
                : "text-slate-700"
            }`}
          >
            {formatKpiValue(value, metric.type)}
          </td>
        );
      })}
      <VmaCell vma={vma} semaphore={semaphore} />
    </tr>
  );
}

function VmaCell({
  vma,
  semaphore,
}: {
  vma: ReturnType<typeof computeVMA>;
  semaphore: ReturnType<typeof vmaSemaphore>;
}) {
  const Icon =
    vma.direction === "up"
      ? TrendingUp
      : vma.direction === "down"
        ? TrendingDown
        : null;
  return (
    <td
      className={`px-2 py-1.5 text-right font-semibold ${SEMAPHORE_BG[semaphore]}`}
    >
      <span className="inline-flex items-center gap-1 justify-end">
        {Icon && <Icon className="h-3 w-3" />}
        {formatVma(vma.percent)}
      </span>
    </td>
  );
}

function EditableCell({
  value,
  type,
  highlighted,
  onSave,
}: {
  value: number | null;
  type: KpiValueType;
  highlighted: boolean;
  onSave: (v: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = useMemo(
    () => formatKpiValue(value, type),
    [value, type],
  );

  useEffect(() => {
    if (editing) {
      setDraft(value !== null ? String(value) : "");
      // Espera al render para enfocar.
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, value]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      // Vacío = 0 (borra si no hay nota, gracias a la regla del server).
      await save(0);
      return;
    }
    const n = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      setEditing(false);
      return;
    }
    await save(n);
  };
  const save = async (v: number) => {
    setSaving(true);
    try {
      await onSave(v);
    } catch (e) {
      // el error lo maneja el caller (alert), acá no hacemos nada extra.
      console.error(e);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  };
  const handleBlur = () => {
    commit();
  };
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    commit();
  };

  return (
    <td
      className={`px-1 py-0.5 text-right ${
        highlighted
          ? "bg-[#003b73]/5 font-semibold text-slate-900"
          : "text-slate-700"
      }`}
    >
      {editing ? (
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step="any"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="w-full text-right rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[11px] outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-400"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full text-right rounded hover:bg-amber-50 hover:text-amber-800 px-1 py-0.5 -mx-1 transition-colors"
          title="Click para editar"
        >
          {displayValue}
        </button>
      )}
    </td>
  );
}
