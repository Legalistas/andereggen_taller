"use client";

import {
  ArrowUpDown,
  Calendar,
  Car,
  Loader2,
  Phone,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
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
import type {
  KanbanRepair,
  RepairStatus,
} from "./production-kanban";

const STATUS_LABEL: Record<RepairStatus, string> = {
  turno_a_asignar: "Turno a Asignar",
  turno_asignado: "Turno Asignado",
  ingresado: "Ingresado",
  pendientes_repuestos: "Pendientes de Repuestos",
  chapa: "Chapa",
  pintura: "Pintura",
  calidad: "Calidad",
  pendientes_cobro: "Pendientes de Cobro",
  experiencia_cliente: "Experiencia Cliente",
  archivado: "Archivado",
};

const STATUS_STYLE: Record<RepairStatus, string> = {
  turno_a_asignar: "bg-blue-100 text-blue-700 border-blue-200",
  turno_asignado: "bg-slate-100 text-slate-700 border-slate-200",
  ingresado: "bg-blue-100 text-blue-700 border-blue-200",
  pendientes_repuestos: "bg-amber-100 text-amber-700 border-amber-200",
  chapa: "bg-orange-100 text-orange-700 border-orange-200",
  pintura: "bg-purple-100 text-purple-700 border-purple-200",
  calidad: "bg-cyan-100 text-cyan-700 border-cyan-200",
  pendientes_cobro: "bg-amber-100 text-amber-800 border-amber-200",
  experiencia_cliente: "bg-emerald-100 text-emerald-700 border-emerald-200",
  archivado: "bg-slate-200 text-slate-700 border-slate-300",
};

type SortBy = "recent" | "oldest" | "name_asc";

const ALL_STATUSES: RepairStatus[] = [
  "turno_a_asignar",
  "turno_asignado",
  "pendientes_repuestos",
  "chapa",
  "pintura",
  "calidad",
  "experiencia_cliente",
  "pendientes_cobro",
];

export default function ProductionList() {
  const [repairs, setRepairs] = useState<KanbanRepair[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<RepairStatus | "all">("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");

  const fetchRepairs = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/repairs?tab=activas", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { repairs: KanbanRepair[] };
      setRepairs(body.repairs);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setLoadError(
          e instanceof Error ? e.message : "Error al cargar reparaciones",
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
    const list = repairs.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
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
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return (
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          );
        case "name_asc":
          return a.customerName.localeCompare(b.customerName, "es");
        default:
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
      }
    });
    return sorted;
  }, [repairs, searchTerm, statusFilter, sortBy]);

  const activeFilters =
    (statusFilter !== "all" ? 1 : 0) + (searchTerm ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter("all");
    setSearchTerm("");
    setSortBy("recent");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta reparación?")) return;
    setRepairs((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/repairs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      await fetchRepairs();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[{ label: "Producción", href: "/produccion" }, { label: "Lista" }]}
        />
        <h1 className="text-3xl font-bold">Lista de reparaciones</h1>
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

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as RepairStatus | "all")}
        >
          <SelectTrigger className="w-56 bg-white">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-44 bg-white">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Más recientes</SelectItem>
              <SelectItem value="oldest">Más antiguos</SelectItem>
              <SelectItem value="name_asc">Nombre (A–Z)</SelectItem>
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
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
              <TableHead>Estado</TableHead>
              <TableHead>Mecánico</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead>Entrega est.</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && repairs.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-sm text-muted-foreground"
                >
                  <Loader2 className="h-4 w-4 inline animate-spin mr-2" />
                  Cargando reparaciones…
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-sm text-muted-foreground italic"
                >
                  Sin reparaciones que coincidan con los filtros.
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
                  <Badge
                    variant="outline"
                    className={`${STATUS_STYLE[r.status]} text-[10px] uppercase tracking-wider font-medium`}
                  >
                    {STATUS_LABEL[r.status]}
                  </Badge>
                  {r.directCreation && (
                    <Badge
                      variant="outline"
                      className="text-[9px] h-4 px-1.5 bg-indigo-50 border-indigo-200 text-indigo-600 font-normal ml-1"
                    >
                      Directa
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {r.assignedMechanic ? (
                    <div className="flex items-center gap-1.5">
                      <div className="h-6 w-6 rounded-full bg-[#003b73] text-white flex items-center justify-center text-[10px] font-semibold">
                        {initials(r.assignedMechanic.name)}
                      </div>
                      <span className="text-sm truncate max-w-[140px]">
                        {r.assignedMechanic.name ?? "—"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Sin asignar
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {r.scheduledAt ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(r.scheduledAt)}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.estimatedDeliveryAt ? (
                    <div className="text-xs text-muted-foreground">
                      {formatDate(r.estimatedDeliveryAt)}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(r.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function initials(name: string | null | undefined): string {
  const s = (name ?? "").trim();
  if (!s) return "?";
  return (
    s
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
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
