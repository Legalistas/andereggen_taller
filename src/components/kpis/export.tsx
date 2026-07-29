/**
 * Export del tablero de KPIs — spec KPIs jul '26.
 *
 * Excel: usa `xlsx` (ya instalado en el proyecto).
 * PDF: usa `@react-pdf/renderer` (ya instalado, mismo que Ficha Técnica).
 */

import { pdf } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import type { KpiGroup, KpiMetric } from "@/lib/kpis/catalog";
import { computeVMA, pickCurrentAndPrevious, vmaSemaphore } from "@/lib/kpis/vma";
import { KpiPdfDocument } from "./kpi-pdf";
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

type ExportArgs = {
  year: number;
  groups: KpiGroup[];
  series: Record<string, Array<number | null>>;
  currentMonthIndex: number;
};

/** Aplana `groups → subGroups → metrics` a filas para Excel/PDF. */
export type FlatRow = {
  kind: "group" | "subGroup" | "metric";
  label: string;
  metric?: KpiMetric;
  values?: Array<number | null>;
  accumulated?: number | null;
  vmaText?: string;
  vmaSemaphore?: "green" | "yellow" | "red" | "na";
};

export function flattenForExport(args: ExportArgs): FlatRow[] {
  const { groups, series, currentMonthIndex } = args;
  const out: FlatRow[] = [];
  for (const g of groups) {
    out.push({ kind: "group", label: `${g.title} — ${g.responsible}` });
    for (const sg of g.subGroups) {
      if (sg.title) out.push({ kind: "subGroup", label: sg.title });
      for (const m of sg.metrics) {
        const values = series[m.key] ?? Array(12).fill(null);
        const { current, previous } = pickCurrentAndPrevious(
          values,
          currentMonthIndex,
        );
        const vma = computeVMA(current, previous);
        const semaphore = vmaSemaphore(vma, { inverted: m.inverted });
        out.push({
          kind: "metric",
          label: m.label,
          metric: m,
          values,
          accumulated: accumulateSeries(values, m.type),
          vmaText: formatVma(vma.percent),
          vmaSemaphore: semaphore,
        });
      }
    }
  }
  return out;
}

export async function exportKpiMatrixExcel(args: ExportArgs): Promise<void> {
  const rows = flattenForExport(args);

  const aoa: Array<Array<string | number | null>> = [];
  // Header
  aoa.push([
    "Métrica",
    `Acum. ${args.year}`,
    ...MONTH_LABELS,
    "VMA",
  ]);
  for (const r of rows) {
    if (r.kind === "group" || r.kind === "subGroup") {
      // Fila de header — solo el label en la primera columna.
      aoa.push([r.label, ...Array(13).fill("")]);
    } else if (r.metric && r.values) {
      aoa.push([
        r.metric.source === "manual"
          ? `${r.metric.label} (manual)`
          : r.metric.label,
        r.accumulated ?? "",
        ...r.values.map((v) => (v === null ? "" : v)),
        r.vmaText ?? "—",
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Anchos razonables: primera col ancha, meses angostos.
  ws["!cols"] = [
    { wch: 42 },
    { wch: 14 },
    ...Array(12).fill({ wch: 12 }),
    { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `KPIs ${args.year}`);
  XLSX.writeFile(wb, `KPIs_Andereggen_${args.year}.xlsx`);
}

export async function exportKpiMatrixPdf(args: ExportArgs): Promise<void> {
  const rows = flattenForExport(args);
  const blob = await pdf(
    <KpiPdfDocument
      year={args.year}
      currentMonthIndex={args.currentMonthIndex}
      rows={rows}
    />,
  ).toBlob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
