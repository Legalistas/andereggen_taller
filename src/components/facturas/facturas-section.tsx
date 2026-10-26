"use client";

import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Landmark,
  Loader2,
  Receipt,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { KpiCard } from "@/components/caja/caja-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * spec 13 · Facturas de compra importadas de "Mis Comprobantes Recibidos" de
 * ARCA: listado del mes, totales (neto, IVA crédito fiscal, total), resumen
 * por proveedor e importación con vista previa.
 */

type Invoice = {
  id: string;
  date: string;
  typeCode: number;
  typeName: string;
  pointOfSale: number;
  number: number;
  issuerCuit: string;
  issuerName: string;
  supplier: { id: string; name: string; accountCode: string | null } | null;
  currency: string;
  netTaxed: number;
  iva: number;
  total: number;
};

type Preview = {
  leidas: number;
  nuevas: number;
  repetidas: number;
  errores: { row: number; motivo: string }[];
  totalErrores: number;
  desde: string | null;
  hasta: string | null;
  netTaxed: number;
  iva: number;
  total: number;
  proveedores: {
    cuit: string;
    arcaName: string;
    accion: "existente" | "vincular" | "crear";
    supplierName?: string;
  }[];
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const ddmmaaaa = (d: string) => `${ddmm(d)}/${d.slice(0, 4)}`;
const numero = (f: Pick<Invoice, "pointOfSale" | "number">) =>
  `${String(f.pointOfSale).padStart(5, "0")}-${String(f.number).padStart(8, "0")}`;
/** "Factura A" → "FA", "Nota de Crédito B" → "NC B". */
const tipoCorto = (nombre: string) =>
  nombre
    .replace(/^Factura de Crédito Electrónica/i, "FCE")
    .replace(/^Nota de Crédito( Electrónica)?/i, "NC")
    .replace(/^Nota de Débito( Electrónica)?/i, "ND")
    .replace(/^Factura /i, "F");

export default function FacturasSection() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const month = `${year}-${String(month0 + 1).padStart(2, "0")}`;

  const cargar = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/supplier-invoices?month=${month}`, {
          signal,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
        setInvoices(body.invoices ?? []);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Error");
        }
      } finally {
        setLoading(false);
      }
    },
    [month],
  );

  useEffect(() => {
    const ac = new AbortController();
    cargar(ac.signal);
    return () => ac.abort();
  }, [cargar]);

  const cambiarMes = (delta: number) => {
    const d = new Date(year, month0 + delta, 1);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
    setSupplierFilter(null);
  };

  const borrar = async (f: Invoice) => {
    if (
      !window.confirm(
        `¿Borrar la ${f.typeName} ${numero(f)} de ${f.issuerName}? Se puede volver a importar desde el archivo de ARCA.`,
      )
    )
      return;
    const res = await fetch(`/api/supplier-invoices/${f.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(body?.error ?? "No se pudo borrar");
      return;
    }
    cargar();
  };

  // Resumen por proveedor (con las notas de crédito restando).
  const porProveedor = [
    ...invoices
      .reduce(
        (m, f) => {
          const k = f.issuerCuit;
          const actual = m.get(k) ?? {
            cuit: k,
            name: f.supplier?.name ?? f.issuerName,
            accountCode: f.supplier?.accountCode ?? null,
            cantidad: 0,
            total: 0,
          };
          actual.cantidad++;
          actual.total += f.total;
          return m.set(k, actual);
        },
        new Map<
          string,
          {
            cuit: string;
            name: string;
            accountCode: string | null;
            cantidad: number;
            total: number;
          }
        >(),
      )
      .values(),
  ].sort((a, b) => b.total - a.total);

  const visibles = supplierFilter
    ? invoices.filter((f) => f.issuerCuit === supplierFilter)
    : invoices;
  const suma = (k: "netTaxed" | "iva" | "total") =>
    invoices.reduce((s, f) => s + f[k], 0);
  const filtro = porProveedor.find((p) => p.cuit === supplierFilter);

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mes anterior"
              onClick={() => cambiarMes(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-40 text-center">
              <div className="text-lg font-semibold text-slate-900">
                {MONTH_LABELS[month0]} {year}
              </div>
              {loading && (
                <div className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mes siguiente"
              onClick={() => cambiarMes(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            className="bg-[#003b73] hover:bg-[#003b73]/90"
            onClick={() => {
              setAviso(null);
              setImportOpen(true);
            }}
          >
            <Upload className="h-4 w-4 mr-1.5" /> Importar de ARCA
          </Button>
        </div>
      </Card>

      {aviso && (
        <Card className="p-3 border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
          {aviso}
        </Card>
      )}
      {error && (
        <Card className="p-3 border-rose-200 bg-rose-50 text-sm text-rose-700">
          No se pudieron cargar las facturas: {error}
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Receipt}
          iconTint="text-[#003b73]"
          iconBg="bg-[#003b73]/10"
          label="Facturas del mes"
          value={String(invoices.length)}
          hint={`${porProveedor.length} ${porProveedor.length === 1 ? "proveedor" : "proveedores"}`}
        />
        <KpiCard
          icon={FileText}
          iconTint="text-slate-600"
          iconBg="bg-slate-100"
          label="Neto gravado"
          value={ARS.format(suma("netTaxed"))}
        />
        <KpiCard
          icon={Landmark}
          iconTint="text-amber-700"
          iconBg="bg-amber-50"
          label="IVA (crédito fiscal)"
          value={ARS.format(suma("iva"))}
        />
        <KpiCard
          icon={Wallet}
          iconTint="text-rose-600"
          iconBg="bg-rose-50"
          label="Total facturado"
          value={ARS.format(suma("total"))}
          hint="Notas de crédito restadas"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="p-0 overflow-hidden gap-0 self-start">
          <div className="px-4 py-3 border-b bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-800">
              Por proveedor
            </h2>
          </div>
          {porProveedor.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Sin facturas este mes.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[32rem] overflow-y-auto">
              {porProveedor.map((p) => {
                const activo = p.cuit === supplierFilter;
                return (
                  <li key={p.cuit}>
                    <button
                      type="button"
                      onClick={() => setSupplierFilter(activo ? null : p.cuit)}
                      className={`w-full px-4 py-2.5 flex items-center gap-3 text-left text-sm transition ${activo ? "bg-[#003b73]/5" : "hover:bg-slate-50"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div
                          className={`truncate font-medium ${activo ? "text-[#003b73]" : "text-slate-900"}`}
                        >
                          {p.name}
                        </div>
                        <div className="truncate text-[11px] text-slate-500 tabular-nums">
                          CUIT {p.cuit}
                          {p.accountCode && ` · Cta. ${p.accountCode}`} ·{" "}
                          {p.cantidad}{" "}
                          {p.cantidad === 1 ? "comprobante" : "comprobantes"}
                        </div>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                        {ARS.format(p.total)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-0 overflow-hidden gap-0">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-800">
              Comprobantes
            </h2>
            {filtro && (
              <button
                type="button"
                onClick={() => setSupplierFilter(null)}
                className="text-[11px] bg-[#003b73]/10 text-[#003b73] px-2 py-0.5 rounded hover:bg-[#003b73]/20"
              >
                {filtro.name} ✕
              </button>
            )}
          </div>
          <div className="hidden sm:flex px-4 py-2 items-center gap-3 border-b bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            <span className="w-11">Fecha</span>
            <span className="w-14">Tipo</span>
            <span className="flex-1">Proveedor</span>
            <span className="w-28 text-right">IVA</span>
            <span className="w-32 text-right">Total</span>
            <span className="w-7" />
          </div>
          {visibles.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              {invoices.length === 0
                ? "No hay facturas importadas de este mes. Usá “Importar de ARCA”."
                : "Ninguna factura coincide con el filtro."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibles.map((f) => {
                const credito = f.total < 0;
                return (
                  <li
                    key={f.id}
                    className="px-4 py-2.5 flex items-center gap-3 text-sm group"
                  >
                    <span className="hidden sm:block w-11 shrink-0 text-xs tabular-nums text-slate-500">
                      {ddmm(f.date)}
                    </span>
                    <span
                      title={f.typeName}
                      className={`hidden sm:block w-14 shrink-0 truncate text-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${credito ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}
                    >
                      {tipoCorto(f.typeName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-900">
                        {f.supplier?.name ?? f.issuerName}
                      </div>
                      <div className="truncate text-[11px] text-slate-500 tabular-nums">
                        {/* En el celular, la fecha y el tipo van acá para dejarle lugar al nombre */}
                        <span className="sm:hidden">
                          {ddmm(f.date)} · {tipoCorto(f.typeName)} ·{" "}
                        </span>
                        {numero(f)} · CUIT {f.issuerCuit}
                        {f.currency !== "PES" && ` · en ${f.currency}`}
                      </div>
                    </div>
                    <span className="hidden sm:block w-28 shrink-0 text-right tabular-nums text-slate-600">
                      {ARS.format(f.iva)}
                    </span>
                    <span
                      className={`w-28 sm:w-32 shrink-0 text-right font-semibold tabular-nums ${credito ? "text-emerald-700" : "text-slate-900"}`}
                    >
                      {ARS.format(f.total)}
                    </span>
                    <button
                      type="button"
                      onClick={() => borrar(f)}
                      aria-label="Borrar factura"
                      className="w-7 shrink-0 rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(texto) => {
          setImportOpen(false);
          setAviso(texto);
          cargar();
        }}
      />
    </div>
  );
}

function ImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (aviso: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setBusy(false);
  };

  const enviar = async (archivo: File, confirm: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", archivo);
      if (confirm) form.append("confirm", "1");
      const res = await fetch("/api/supplier-invoices/import", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      if (!confirm) {
        setPreview(body.preview);
        return;
      }
      const r = body.result;
      const partes = [
        `Se importaron ${r.importadas} ${r.importadas === 1 ? "factura" : "facturas"}`,
        r.proveedoresCreados > 0 &&
          `${r.proveedoresCreados} proveedores nuevos`,
        r.proveedoresVinculados > 0 &&
          `${r.proveedoresVinculados} proveedores vinculados por CUIT`,
      ].filter(Boolean);
      reset();
      onImported(`${partes.join(", ")}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo");
    } finally {
      setBusy(false);
    }
  };

  const crear = preview?.proveedores.filter((p) => p.accion === "crear") ?? [];
  const vincular =
    preview?.proveedores.filter((p) => p.accion === "vincular") ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar facturas de ARCA</DialogTitle>
          <DialogDescription className="text-xs">
            En ARCA entrá a <b>Mis Comprobantes → Recibidos</b>, elegí el
            período y descargá el Excel o el CSV. Las facturas que ya estaban
            cargadas no se repiten.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-slate-300 p-4 hover:border-[#003b73] hover:bg-[#003b73]/5">
          <FileSpreadsheet className="h-6 w-6 shrink-0 text-[#003b73]" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="truncate font-medium text-slate-900">
              {file
                ? file.name
                : "Elegir el archivo de Mis Comprobantes Recibidos"}
            </div>
            <div className="text-[11px] text-slate-500">
              Excel (.xlsx) o CSV, hasta 4 MB
            </div>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setFile(f);
              setPreview(null);
              enviar(f, false);
            }}
          />
        </label>

        {busy && !preview && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Leyendo el archivo…
          </div>
        )}
        {error && (
          <Card className="p-3 border-rose-200 bg-rose-50 text-sm text-rose-700">
            {error}
          </Card>
        )}

        {preview && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <Dato label="Nuevas" valor={String(preview.nuevas)} fuerte />
              <Dato label="Ya estaban" valor={String(preview.repetidas)} />
              <Dato
                label="Con error"
                valor={String(preview.totalErrores)}
                alerta={preview.totalErrores > 0}
              />
            </div>
            {preview.nuevas > 0 && (
              <div className="rounded-md bg-slate-50 p-3 text-[13px] text-slate-700">
                Del {ddmmaaaa(preview.desde ?? "")} al{" "}
                {ddmmaaaa(preview.hasta ?? "")}: neto{" "}
                <b className="tabular-nums">{ARS.format(preview.netTaxed)}</b>,
                IVA <b className="tabular-nums">{ARS.format(preview.iva)}</b>,
                total{" "}
                <b className="tabular-nums">{ARS.format(preview.total)}</b>.
              </div>
            )}
            {vincular.length > 0 && (
              <Lista
                titulo={`Se completa el CUIT de ${vincular.length} ${vincular.length === 1 ? "proveedor que ya existía" : "proveedores que ya existían"}`}
                filas={vincular.map(
                  (p) => `${p.supplierName} ← ${p.arcaName} (${p.cuit})`,
                )}
              />
            )}
            {crear.length > 0 && (
              <Lista
                titulo={`Se ${crear.length === 1 ? "crea 1 proveedor nuevo" : `crean ${crear.length} proveedores nuevos`}`}
                filas={crear.map((p) => `${p.arcaName} (${p.cuit})`)}
              />
            )}
            {preview.errores.length > 0 && (
              <Lista
                titulo="Filas que no se van a importar"
                filas={preview.errores.map((e) => `Fila ${e.row}: ${e.motivo}`)}
                alerta
              />
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            className="bg-[#003b73] hover:bg-[#003b73]/90"
            disabled={!file || !preview || preview.nuevas === 0 || busy}
            onClick={() => file && enviar(file, true)}
          >
            {busy && preview && (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            )}
            {preview && preview.nuevas > 0
              ? `Importar ${preview.nuevas} ${preview.nuevas === 1 ? "factura" : "facturas"}`
              : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Dato({
  label,
  valor,
  fuerte,
  alerta,
}: {
  label: string;
  valor: string;
  fuerte?: boolean;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`text-lg font-bold tabular-nums ${alerta ? "text-rose-700" : fuerte ? "text-[#003b73]" : "text-slate-900"}`}
      >
        {valor}
      </div>
    </div>
  );
}

function Lista({
  titulo,
  filas,
  alerta,
}: {
  titulo: string;
  filas: string[];
  alerta?: boolean;
}) {
  return (
    <div>
      <div
        className={`mb-1 text-xs font-semibold ${alerta ? "text-rose-700" : "text-slate-700"}`}
      >
        {titulo}
      </div>
      <ul className="max-h-32 overflow-y-auto rounded-md border border-slate-200 text-[12px] text-slate-600 divide-y divide-slate-100">
        {filas.map((f) => (
          <li key={f} className="px-2 py-1 truncate">
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
