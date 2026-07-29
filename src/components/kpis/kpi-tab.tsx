"use client";

/**
 * Pestaña "KPIs" de Estadísticas — vista consolidada.
 *
 * spec KPIs jul '26 · Orquesta el fetch de `/api/kpis/matrix`, permite
 * cambiar el año, y dispara el export a Excel / PDF.
 */

import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
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
import { KPI_GROUPS, type KpiGroupKey } from "@/lib/kpis/catalog";
import { exportKpiMatrixExcel, exportKpiMatrixPdf } from "./export";
import KpiMatrix from "./kpi-matrix";

type MatrixPayload = {
  year: number;
  canSeeRestricted: boolean;
  visibleGroups: KpiGroupKey[];
  series: Record<string, Array<number | null>>;
};

const AVAILABLE_YEARS = (() => {
  const current = new Date().getFullYear();
  const arr: number[] = [];
  for (let y = current + 1; y >= current - 3; y--) arr.push(y);
  return arr;
})();

export default function KpiTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<MatrixPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const fetchMatrix = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/kpis/matrix?year=${year}`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = (await res.json()) as MatrixPayload;
        setData(d);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Error");
        }
      } finally {
        setLoading(false);
      }
    },
    [year],
  );

  useEffect(() => {
    const ac = new AbortController();
    fetchMatrix(ac.signal);
    return () => ac.abort();
  }, [fetchMatrix]);

  const visibleGroups = useMemo(() => {
    if (!data) return [];
    const allowed = new Set(data.visibleGroups);
    return KPI_GROUPS.filter((g) => allowed.has(g.key));
  }, [data]);

  // Mes actual dentro del año visible: si es el año en curso, es el mes real;
  // si el usuario navega a un año pasado, resaltamos diciembre (mes de cierre).
  const currentMonthIndex =
    year === now.getFullYear() ? now.getMonth() : 11;

  const handleEditManual = async ({
    metricKey,
    month,
    value,
  }: {
    metricKey: string;
    month: number;
    value: number;
  }) => {
    try {
      const res = await fetch("/api/kpis/manual", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metricKey, year, month, value }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      await fetchMatrix();
    } catch (e) {
      window.alert(
        e instanceof Error ? `No se pudo guardar: ${e.message}` : "Error",
      );
    }
  };

  const doExport = async (kind: "excel" | "pdf") => {
    if (!data) return;
    setExporting(kind);
    try {
      const fn = kind === "excel" ? exportKpiMatrixExcel : exportKpiMatrixPdf;
      await fn({
        year,
        groups: visibleGroups,
        series: data.series,
        currentMonthIndex,
      });
    } catch (e) {
      window.alert(
        e instanceof Error ? `No se pudo exportar: ${e.message}` : "Error",
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600" htmlFor="kpi-year">
              Año
            </label>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
            >
              <SelectTrigger id="kpi-year" className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => doExport("excel")}
              disabled={!data || exporting !== null}
              className="gap-1.5"
            >
              {exporting === "excel" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => doExport("pdf")}
              disabled={!data || exporting !== null}
              className="gap-1.5"
            >
              {exporting === "pdf" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              PDF
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-3 border-rose-200 bg-rose-50 text-sm text-rose-700">
          No se pudo cargar el tablero: {error}
        </Card>
      )}

      {!data && !error && loading && (
        <Card className="p-12 flex items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </Card>
      )}

      {data && (
        <KpiMatrix
          year={year}
          groups={visibleGroups}
          series={data.series}
          currentMonthIndex={currentMonthIndex}
          onEditManual={handleEditManual}
        />
      )}

      {data && !data.canSeeRestricted && (
        <p className="text-[11px] text-slate-500 italic">
          El grupo Caja / Finanzas está oculto — solo lo ven roles Contable y
          Administrador.
        </p>
      )}
    </div>
  );
}
