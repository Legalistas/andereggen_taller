"use client";

/**
 * Orquestador del módulo /compras — spec Compras v2.
 * Paginación server-side; badges y summary vienen del server (independientes
 * de la página actual). Sidecars: suppliers activos + cash boxes.
 */

import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PURCHASE_STATUS_META,
  PURCHASE_STATUSES_IN_ORDER,
} from "@/lib/purchases/catalog";
import type { PurchaseStatus } from "../../../generated/prisma/client";
import NewDirectPurchaseDialog from "./new-direct-purchase-dialog";
import PurchaseDetailDialog from "./purchase-detail-dialog";
import PurchasesTable from "./purchases-table";
import type { CashBoxLite, PurchaseRow, SupplierLite } from "./types";

type Tab = PurchaseStatus | "TODAS";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

type Summary = {
  itemsRegistered: number;
  totalPurchased: number;
  estimatedPending: number;
};

export default function PurchasesSection() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBoxLite[]>([]);
  const [tab, setTab] = useState<Tab>("TODAS");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [countsByStatus, setCountsByStatus] = useState<
    Record<string, number>
  >({});
  const [summary, setSummary] = useState<Summary>({
    itemsRegistered: 0,
    totalPurchased: 0,
    estimatedPending: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (tab !== "TODAS") params.set("status", tab);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`/api/purchases?${params.toString()}`);
      const raw = await res.text();
      const body = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setPurchases(body.purchases ?? []);
      setTotal(body.pagination?.total ?? 0);
      setTotalPages(body.pagination?.totalPages ?? 1);
      setCountsByStatus(body.countsByStatus ?? {});
      setSummary(
        body.summary ?? {
          itemsRegistered: 0,
          totalPurchased: 0,
          estimatedPending: 0,
        },
      );
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "No se pudieron cargar las compras.",
      );
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [search, tab, page, pageSize]);

  // Sidecars (una sola vez). Suppliers piden pageSize=0 → sin paginar.
  useEffect(() => {
    (async () => {
      try {
        const [supRes, boxRes] = await Promise.all([
          fetch("/api/suppliers?pageSize=0&active=1"),
          fetch("/api/caja/boxes"),
        ]);
        if (supRes.ok) {
          const raw = await supRes.text();
          const d = raw ? JSON.parse(raw) : {};
          setSuppliers(
            ((d.suppliers ?? []) as SupplierLite[]).filter((s) => s.isActive),
          );
        }
        if (boxRes.ok) {
          const raw = await boxRes.text();
          const d = raw ? JSON.parse(raw) : {};
          setCashBoxes((d.boxes ?? []) as CashBoxLite[]);
        }
      } catch (e) {
        console.error("Error cargando sidecars", e);
      }
    })();
  }, []);

  // Fetch (debounced por búsqueda).
  useEffect(() => {
    const t = setTimeout(() => {
      fetchPurchases();
    }, 200);
    return () => clearTimeout(t);
  }, [fetchPurchases]);

  return (
    <div className="space-y-4">
      <SummaryCardsFromServer summary={summary} />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por N° compra, ítem, proveedor, patente o cliente…"
              className="pl-8 h-9"
            />
          </div>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / pág
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* spec v3 · Botón "Agregar" para cargar compras directas
              (con o sin presupuesto/vehículo). Vale en Cotizar y en Todas. */}
          {(tab === "COTIZAR" || tab === "TODAS") && (
            <Button
              size="sm"
              className="gap-1.5 h-9"
              onClick={() => setNewOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          )}
          {loading && (
            <div className="text-xs text-slate-500 inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cargando…
            </div>
          )}
        </div>
      </Card>

      {loadError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          setPage(1);
        }}
      >
        <TabsList className="flex flex-wrap h-auto p-1 gap-1 bg-slate-100">
          <TabsTrigger value="TODAS" className="gap-1.5">
            Todas
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-700 tabular-nums">
              {Object.values(countsByStatus).reduce((a, b) => a + b, 0)}
            </span>
          </TabsTrigger>
          {PURCHASE_STATUSES_IN_ORDER.map((s) => {
            const meta = PURCHASE_STATUS_META[s];
            const count = countsByStatus[s] ?? 0;
            return (
              <TabsTrigger key={s} value={s} className="gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${meta.tone.dot}`} />
                {meta.label}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-700 tabular-nums">
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden">
        {tab !== "TODAS" && (
          <div className="px-4 py-2 border-b bg-slate-50 text-xs text-slate-600">
            {PURCHASE_STATUS_META[tab].description}
          </div>
        )}
        <div className="overflow-x-auto">
          <PurchasesTable
            rows={purchases}
            onOpenDetail={(row) => setOpenId(row.id)}
          />
        </div>
      </Card>

      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-600">
          <div>
            Mostrando{" "}
            <strong className="tabular-nums">
              {(page - 1) * pageSize + 1}
            </strong>
            –
            <strong className="tabular-nums">
              {Math.min(page * pageSize, total)}
            </strong>{" "}
            de <strong className="tabular-nums">{total}</strong>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 tabular-nums">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {openId && (
        <PurchaseDetailDialog
          purchaseId={openId}
          suppliers={suppliers}
          cashBoxes={cashBoxes}
          onClose={() => setOpenId(null)}
          onChanged={fetchPurchases}
        />
      )}

      {newOpen && (
        <NewDirectPurchaseDialog
          onClose={() => setNewOpen(false)}
          onCreated={(id) => {
            setNewOpen(false);
            fetchPurchases();
            setOpenId(id);
          }}
        />
      )}
    </div>
  );
}

/**
 * Variante del SummaryCards que consume el summary ya calculado por el
 * server (no necesita las purchases). Mismo look que el summary local.
 */
function SummaryCardsFromServer({ summary }: { summary: Summary }) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">
          Ítems registrados
        </div>
        <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
          {summary.itemsRegistered}
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">
          Total comprado
        </div>
        <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">
          {ARS.format(summary.totalPurchased)}
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">
          Estimado pendiente
        </div>
        <div className="text-2xl font-bold text-amber-700 tabular-nums mt-1">
          {ARS.format(summary.estimatedPending)}
        </div>
      </Card>
    </div>
  );
}
