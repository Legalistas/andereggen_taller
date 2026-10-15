"use client";

import { ArrowUpDown, Search, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COLUMNS,
  IN_WORKSHOP_STATUSES,
  type KanbanRepair,
  ProductionKanban,
  type RepairStatus,
} from "./production-kanban";
import { RepairCanvas } from "./repair-canvas";

type MechanicOption = {
  id: string;
  name: string | null;
  email: string | null;
};

type SortBy = "recent" | "oldest" | "name_asc";

export default function ProductionSection() {
  const [repairs, setRepairs] = useState<KanbanRepair[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [mechanicFilter, setMechanicFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  // Solo las etapas con el auto adentro del taller.
  const [inWorkshopOnly, setInWorkshopOnly] = useState(false);
  // Multi-tilde: cards sobre las que aplicar "Mover a…" / "Motorista…" en lote.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Mecánicos disponibles para filtro + dialog nueva reparación
  const [mechanics, setMechanics] = useState<MechanicOption[]>([]);

  // Canvas lateral: repairId abierto (null = cerrado)
  const [canvasRepairId, setCanvasRepairId] = useState<string | null>(null);

  /**
   * Deep-link `/produccion?repairId=...` — lo usan Caja, Calendario y Compras
   * para saltar a la ficha del vehículo. Hasta ahora el link navegaba pero la
   * ficha no se abría. Mismo criterio que en CRM: se lee en el mount y se
   * limpia el parámetro.
   */
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("repairId");
    if (!id) return;
    setCanvasRepairId(id);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

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

  // Cargar mecánicos para filtro y selector
  useEffect(() => {
    fetch("/api/users?role=mecanico")
      .then((r) => r.json())
      .then((b) => setMechanics((b.users ?? []) as MechanicOption[]))
      .catch(() => setMechanics([]));
  }, []);

  const filteredRepairs = useMemo(() => {
    const t = searchTerm.toLowerCase();
    const filtered = repairs.filter((r) => {
      if (inWorkshopOnly && !IN_WORKSHOP_STATUSES.includes(r.status)) return false;
      if (mechanicFilter === "unassigned" && r.assignedMechanic) return false;
      if (
        mechanicFilter !== "all" &&
        mechanicFilter !== "unassigned" &&
        r.assignedMechanic?.id !== mechanicFilter
      )
        return false;
      if (t) {
        // spec v2 · También matchea por N° interno (con o sin "#" y con o
        // sin ceros a la izquierda). Ej: "192", "#192", "0192" → repair 192.
        const cleaned = t.replace(/^#/, "").replace(/^0+/, "");
        const matches =
          r.customerName.toLowerCase().includes(t) ||
          `${r.vehicleBrand} ${r.vehicleModel} ${r.vehicleDomain}`
            .toLowerCase()
            .includes(t) ||
          (r.internalNumber !== null &&
            String(r.internalNumber) === cleaned);
        if (!matches) return false;
      }
      return true;
    });

    const sorted = [...filtered];
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
  }, [repairs, searchTerm, mechanicFilter, sortBy, inWorkshopOnly]);

  const activeFiltersCount =
    (mechanicFilter !== "all" ? 1 : 0) + (searchTerm ? 1 : 0);

  const clearFilters = () => {
    setMechanicFilter("all");
    setSearchTerm("");
    setSortBy("recent");
  };

  const handleStatusChange = async (repairId: string, next: RepairStatus) => {
    setRepairs((prev) =>
      prev.map((r) =>
        r.id === repairId
          ? { ...r, status: next, updatedAt: new Date().toISOString() }
          : r,
      ),
    );
    try {
      const res = await fetch(`/api/repairs/${repairId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      // Reemplazamos con lo que devuelve el server (incluye fechas setteadas por side-effects)
      setRepairs((prev) =>
        prev.map((r) => (r.id === repairId ? { ...r, ...body.repair } : r)),
      );

      // Si pasó a archivado, sacarlo del tablero (tab=activas)
      if (next === "archivado") {
        setRepairs((prev) => prev.filter((r) => r.id !== repairId));
      }
    } catch {
      await fetchRepairs();
    }
  };

  const handleAssignMechanic = async (
    repairId: string,
    mechanicId: string | null,
  ) => {
    const mech = mechanics.find((m) => m.id === mechanicId) ?? null;
    setRepairs((prev) =>
      prev.map((r) =>
        r.id === repairId
          ? { ...r, assignedMechanic: mech ? { ...mech, image: null } : null }
          : r,
      ),
    );
    try {
      const res = await fetch(`/api/repairs/${repairId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedMechanicId: mechanicId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      await fetchRepairs();
    }
  };

  const toggleSelect = (repairId: string, next: boolean) =>
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(repairId);
      else s.delete(repairId);
      return s;
    });

  /** Aplica una acción a cada card tildada y limpia la selección. */
  const applyToSelected = async (fn: (id: string) => Promise<void>) => {
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    for (const id of ids) await fn(id);
  };

  const handleDelete = async (repairId: string) => {
    if (!confirm("¿Eliminar esta reparación?")) return;
    setRepairs((prev) => prev.filter((r) => r.id !== repairId));
    try {
      const res = await fetch(`/api/repairs/${repairId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      await fetchRepairs();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Producción" }]} />
          <h1 className="text-3xl font-bold text-foreground">Producción</h1>
        </div>

      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Buscar por cliente, patente, modelo o N° interno…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        <Select value={mechanicFilter} onValueChange={setMechanicFilter}>
          <SelectTrigger className="w-56 bg-white">
            <SelectValue placeholder="Mecánico" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los mecánicos</SelectItem>
            <SelectItem value="unassigned">Sin asignar</SelectItem>
            {mechanics.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name ?? m.email ?? m.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={inWorkshopOnly ? "default" : "outline"}
          onClick={() => setInWorkshopOnly((v) => !v)}
          className="gap-1.5"
          title="Solo las etapas con el auto adentro: Pendientes de repuestos, Chapa, Pintura y Calidad"
        >
          <Wrench className="h-4 w-4" />
          En taller
          <span className="text-[10px] tabular-nums opacity-80">
            {repairs.filter((r) => IN_WORKSHOP_STATUSES.includes(r.status)).length}
          </span>
        </Button>

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
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-slate-500 hover:text-slate-900 gap-1"
            >
              <X className="h-3.5 w-3.5" />
              {activeFiltersCount}
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="rounded-md border border-[#003b73]/20 bg-[#003b73]/5 px-3 py-2 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-slate-700">
            {selectedIds.size} seleccionada(s)
          </span>
          <Select
            value=""
            onValueChange={(v) =>
              applyToSelected((id) => handleStatusChange(id, v as RepairStatus))
            }
          >
            <SelectTrigger className="h-8 w-48 bg-white text-xs">
              <SelectValue placeholder="Mover a…" />
            </SelectTrigger>
            <SelectContent>
              {COLUMNS.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value=""
            onValueChange={(v) =>
              applyToSelected((id) =>
                handleAssignMechanic(id, v === "__none" ? null : v),
              )
            }
          >
            <SelectTrigger className="h-8 w-48 bg-white text-xs">
              <SelectValue placeholder="Motorista…" />
            </SelectTrigger>
            <SelectContent>
              {mechanics.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name ?? m.email ?? m.id}
                </SelectItem>
              ))}
              <SelectItem value="__none">Sin asignar</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            className="h-8 text-slate-600"
          >
            Limpiar
          </Button>
        </div>
      )}

      <ProductionKanban
        repairs={filteredRepairs}
        loading={loading}
        onStatusChange={handleStatusChange}
        onOpenDetail={(r) => setCanvasRepairId(r.id)}
        onDelete={handleDelete}
        mechanics={mechanics}
        onAssignMechanic={handleAssignMechanic}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />

      {/* Canvas lateral con detalle de la reparación */}
      <RepairCanvas
        repairId={canvasRepairId}
        onClose={() => setCanvasRepairId(null)}
        onChanged={() => fetchRepairs()}
      />
    </div>
  );
}
