"use client";

import { Calendar, Car, Loader2, Phone, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { KanbanRepair } from "./production-kanban";

type RangeFilter = "all" | "30d" | "90d" | "365d";

export default function ProductionHistory() {
  const [repairs, setRepairs] = useState<KanbanRepair[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [range, setRange] = useState<RangeFilter>("all");

  const fetchRepairs = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/repairs?tab=archivadas", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { repairs: KanbanRepair[] };
      setRepairs(body.repairs);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setLoadError(
          e instanceof Error ? e.message : "Error al cargar histórico",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetchRepairs(ac.signal);
    return () => ac.abort();
  }, [fetchRepairs]);

  const filtered = useMemo(() => {
    const t = searchTerm.toLowerCase();
    const periodMs: Record<RangeFilter, number> = {
      all: Number.POSITIVE_INFINITY,
      "30d": 30 * 86_400_000,
      "90d": 90 * 86_400_000,
      "365d": 365 * 86_400_000,
    };
    const cutoff = Date.now() - periodMs[range];
    return repairs.filter((r) => {
      if (
        range !== "all" &&
        r.archivedAt &&
        new Date(r.archivedAt).getTime() < cutoff
      )
        return false;
      if (t) {
        const matches =
          r.customerName.toLowerCase().includes(t) ||
          `${r.vehicleBrand} ${r.vehicleModel} ${r.vehicleDomain}`
            .toLowerCase()
            .includes(t);
        if (!matches) return false;
      }
      return true;
    });
  }, [repairs, searchTerm, range]);

  const activeFilters = (range !== "all" ? 1 : 0) + (searchTerm ? 1 : 0);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: "Producción", href: "/produccion" },
            { label: "Histórico" },
          ]}
        />
        <h1 className="text-3xl font-bold">Histórico de reparaciones</h1>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Buscar por cliente, patente, modelo…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        <Select value={range} onValueChange={(v) => setRange(v as RangeFilter)}>
          <SelectTrigger className="w-44 bg-white">
            <SelectValue placeholder="Rango" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo el histórico</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
            <SelectItem value="90d">Últimos 90 días</SelectItem>
            <SelectItem value="365d">Último año</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRange("all");
                setSearchTerm("");
              }}
              className="text-slate-500 hover:text-slate-900 gap-1"
            >
              <X className="h-3.5 w-3.5" />
              {activeFilters}
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Vehículo</TableHead>
              <TableHead>Mecánico</TableHead>
              <TableHead>Archivado</TableHead>
              <TableHead>Origen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && repairs.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-12 text-sm text-muted-foreground"
                >
                  <Loader2 className="h-4 w-4 inline animate-spin mr-2" />
                  Cargando histórico…
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-12 text-sm text-muted-foreground italic"
                >
                  Sin reparaciones archivadas en este rango.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id} className="hover:bg-slate-50">
                <TableCell>
                  <div className="font-medium">{r.customerName}</div>
                  {r.customerPhone && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {r.customerPhone}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-start gap-1.5">
                    <Car className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <div>
                        {r.vehicleBrand} {r.vehicleModel} {r.vehicleYear}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground uppercase">
                        {r.vehicleDomain}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {r.assignedMechanic ? (
                    <span className="text-sm">
                      {r.assignedMechanic.name ?? "—"}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      Sin asignar
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {r.archivedAt ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(r.archivedAt)}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.directCreation ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700"
                    >
                      Directa
                    </Badge>
                  ) : r.budget ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700"
                    >
                      Presup. #{r.budget.number}
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
