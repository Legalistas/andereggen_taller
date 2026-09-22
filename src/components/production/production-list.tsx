"use client";

import {
  ArrowUpDown,
  Calendar,
  Car,
  ClipboardList,
  Loader2,
  Phone,
  Search,
  Shield,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { KanbanRepair, RepairStatus } from "./production-kanban";

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

type SortBy = "recent" | "oldest" | "name_asc" | "entered_desc";

/**
 * Quién paga el trabajo. Sale de los importes aprobados cargados en la ficha:
 * una misma reparación puede tener seguro + franquicia a la vez (el seguro
 * aprueba la mayor parte y el cliente pone la franquicia).
 */
type PayerFilter = "all" | "seguro" | "franquicia" | "particular" | "sin";

const PAYER_LABEL: Record<Exclude<PayerFilter, "all">, string> = {
  seguro: "Seguro",
  franquicia: "Franquicia",
  particular: "Particular",
  sin: "Sin aprobación",
};

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

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** Los importes vienen como Decimal serializado (string) desde el server. */
function num(v: string | number | null | undefined): number {
  return v === null || v === undefined ? 0 : Number(v);
}

function payersOf(r: KanbanRepair): Array<Exclude<PayerFilter, "all" | "sin">> {
  const out: Array<Exclude<PayerFilter, "all" | "sin">> = [];
  if (num(r.approvedInsurance) > 0) out.push("seguro");
  if (num(r.approvedFranchise) > 0) out.push("franquicia");
  if (num(r.approvedCustomer) > 0) out.push("particular");
  return out;
}

export default function ProductionList() {
  const [repairs, setRepairs] = useState<KanbanRepair[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<RepairStatus | "all">("all");
  const [insuranceFilter, setInsuranceFilter] = useState<string>("all");
  const [payerFilter, setPayerFilter] = useState<PayerFilter>("all");
  const [mechanicFilter, setMechanicFilter] = useState<string>("all");
  const [enteredFrom, setEnteredFrom] = useState("");
  const [enteredTo, setEnteredTo] = useState("");
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

  // Opciones de los filtros derivadas de lo que hay en pantalla: no tiene
  // sentido ofrecer una compañía o un mecánico sin reparaciones activas.
  const insuranceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of repairs) {
      if (r.insuranceCompany) set.add(r.insuranceCompany);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [repairs]);

  const mechanicOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of repairs) {
      if (r.assignedMechanic) {
        map.set(r.assignedMechanic.id, r.assignedMechanic.name ?? "Sin nombre");
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [repairs]);

  const filtered = useMemo(() => {
    const t = searchTerm.toLowerCase();
    // Las fechas del filtro son locales: comparamos contra el día completo.
    const from = enteredFrom ? new Date(`${enteredFrom}T00:00:00`) : null;
    const to = enteredTo ? new Date(`${enteredTo}T23:59:59`) : null;

    const list = repairs.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (insuranceFilter !== "all" && r.insuranceCompany !== insuranceFilter) {
        return false;
      }
      if (mechanicFilter !== "all") {
        if (mechanicFilter === "none") {
          if (r.assignedMechanic) return false;
        } else if (r.assignedMechanic?.id !== mechanicFilter) {
          return false;
        }
      }
      if (payerFilter !== "all") {
        const payers = payersOf(r);
        if (payerFilter === "sin") {
          if (payers.length > 0) return false;
        } else if (!payers.includes(payerFilter)) {
          return false;
        }
      }
      if (from || to) {
        if (!r.enteredAt) return false;
        const entered = new Date(r.enteredAt);
        if (from && entered < from) return false;
        if (to && entered > to) return false;
      }
      if (t) {
        // spec v2 · Match también por N° interno (con o sin "#" y ceros).
        const cleaned = t.replace(/^#/, "").replace(/^0+/, "");
        const matches =
          r.customerName.toLowerCase().includes(t) ||
          `${r.vehicleBrand} ${r.vehicleModel} ${r.vehicleDomain}`
            .toLowerCase()
            .includes(t) ||
          (r.vehicleColor ?? "").toLowerCase().includes(t) ||
          (r.insuranceCompany ?? "").toLowerCase().includes(t) ||
          (r.urgencyNote ?? "").toLowerCase().includes(t) ||
          (r.internalNumber !== null && String(r.internalNumber) === cleaned);
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
        case "entered_desc": {
          // Sin fecha de ingreso van al final: todavía no entraron al taller.
          const at = a.enteredAt ? new Date(a.enteredAt).getTime() : -Infinity;
          const bt = b.enteredAt ? new Date(b.enteredAt).getTime() : -Infinity;
          return bt - at;
        }
        default:
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
      }
    });
    return sorted;
  }, [
    repairs,
    searchTerm,
    statusFilter,
    insuranceFilter,
    payerFilter,
    mechanicFilter,
    enteredFrom,
    enteredTo,
    sortBy,
  ]);

  const activeFilters =
    (statusFilter !== "all" ? 1 : 0) +
    (insuranceFilter !== "all" ? 1 : 0) +
    (payerFilter !== "all" ? 1 : 0) +
    (mechanicFilter !== "all" ? 1 : 0) +
    (enteredFrom ? 1 : 0) +
    (enteredTo ? 1 : 0) +
    (searchTerm ? 1 : 0);

  const clearFilters = () => {
    setStatusFilter("all");
    setInsuranceFilter("all");
    setPayerFilter("all");
    setMechanicFilter("all");
    setEnteredFrom("");
    setEnteredTo("");
    setSearchTerm("");
    setSortBy("recent");
  };

  // Totales de lo filtrado: con los filtros de arriba la lista sirve para
  // responder "cuánto tengo aprobado con Sancor" sin exportar nada.
  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({
          budgets: acc.budgets + (r.budgetsTotal ?? 0),
          approved: acc.approved + (r.approvedTotal ?? 0),
          pending: acc.pending + (r.pendingAmount ?? 0),
        }),
        { budgets: 0, approved: 0, pending: 0 },
      ),
    [filtered],
  );

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
          items={[
            { label: "Producción", href: "/produccion" },
            { label: "Lista" },
          ]}
        />
        <h1 className="text-3xl font-bold">Lista de reparaciones</h1>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Buscar por cliente, patente, color, seguro o N° interno…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as RepairStatus | "all")}
          >
            <SelectTrigger className="w-52 bg-white">
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
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortBy)}
            >
              <SelectTrigger className="w-48 bg-white">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Más recientes</SelectItem>
                <SelectItem value="oldest">Más antiguos</SelectItem>
                <SelectItem value="entered_desc">Último ingreso</SelectItem>
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

        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="grid gap-1">
            <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Compañía de seguros
            </Label>
            <Select value={insuranceFilter} onValueChange={setInsuranceFilter}>
              <SelectTrigger className="w-56 bg-white">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las compañías</SelectItem>
                {insuranceOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Quién aprueba
            </Label>
            <Select
              value={payerFilter}
              onValueChange={(v) => setPayerFilter(v as PayerFilter)}
            >
              <SelectTrigger className="w-48 bg-white">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="seguro">Seguro</SelectItem>
                <SelectItem value="franquicia">Franquicia</SelectItem>
                <SelectItem value="particular">Particular</SelectItem>
                <SelectItem value="sin">Sin aprobación cargada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Mecánico
            </Label>
            <Select value={mechanicFilter} onValueChange={setMechanicFilter}>
              <SelectTrigger className="w-52 bg-white">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="none">Sin asignar</SelectItem>
                {mechanicOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Ingreso desde
            </Label>
            <Input
              type="date"
              value={enteredFrom}
              onChange={(e) => setEnteredFrom(e.target.value)}
              className="w-40 bg-white"
            />
          </div>

          <div className="grid gap-1">
            <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Ingreso hasta
            </Label>
            <Input
              type="date"
              value={enteredTo}
              onChange={(e) => setEnteredTo(e.target.value)}
              className="w-40 bg-white"
            />
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {/* Totales de lo que quedó filtrado. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-600">
        <span>
          <strong className="text-slate-900">{filtered.length}</strong>{" "}
          reparación(es)
        </span>
        <span>
          Presupuestado:{" "}
          <strong className="tabular-nums text-slate-900">
            {ARS.format(totals.budgets)}
          </strong>
        </span>
        <span>
          Aprobado:{" "}
          <strong className="tabular-nums text-emerald-700">
            {ARS.format(totals.approved)}
          </strong>
        </span>
        <span>
          Pendiente de cobro:{" "}
          <strong className="tabular-nums text-rose-600">
            {ARS.format(totals.pending)}
          </strong>
        </span>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">N° int.</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Seguro</TableHead>
                <TableHead>Ingreso</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead>Entrega est.</TableHead>
                <TableHead>Mecánico</TableHead>
                <TableHead>Aprueba</TableHead>
                <TableHead className="text-right">Importes</TableHead>
                <TableHead className="w-12 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && repairs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={12}
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
                    colSpan={12}
                    className="text-center py-12 text-sm text-muted-foreground italic"
                  >
                    Sin reparaciones que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => {
                const payers = payersOf(r);
                return (
                  <TableRow key={r.id} className="hover:bg-slate-50">
                    <TableCell>
                      {r.internalNumber !== null ? (
                        <span className="font-mono text-xs font-bold text-[#003b73]">
                          #{r.internalNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                      {r.isUrgent && (
                        <div
                          className="mt-1 inline-flex items-center gap-1 rounded bg-[#fbff2b] border border-yellow-500 text-yellow-950 px-1 py-px text-[9px] font-bold uppercase tracking-wider"
                          title={
                            r.urgencyNote
                              ? `Urgente: ${r.urgencyNote}`
                              : "El cliente tiene urgencia con la fecha"
                          }
                        >
                          <Zap className="h-2.5 w-2.5" />
                          Urgente
                        </div>
                      )}
                      {r.claimCount > 1 && (
                        <div
                          className="mt-1 inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 px-1 py-px text-[9px] font-medium"
                          title="La tarjeta tiene más de un siniestro"
                        >
                          <ClipboardList className="h-2.5 w-2.5" />
                          {r.claimCount} stros
                        </div>
                      )}
                    </TableCell>
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
                          {r.vehicleColor && (
                            <div className="text-[10px] text-slate-500">
                              Color: {r.vehicleColor}
                            </div>
                          )}
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
                      {r.insuranceCompany ? (
                        <div className="flex items-center gap-1 text-xs text-sky-800">
                          <Shield className="h-3 w-3 shrink-0 text-sky-500" />
                          <span className="truncate max-w-[130px]">
                            {r.insuranceCompany}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.enteredAt ? (
                        <div className="flex items-center gap-1 text-xs font-medium text-slate-700">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {formatDate(r.enteredAt)}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          No ingresó
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.scheduledAt ? (
                        <div className="text-xs text-muted-foreground">
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
                    <TableCell>
                      {r.assignedMechanic ? (
                        <div className="flex items-center gap-1.5">
                          <div className="h-6 w-6 rounded-full bg-[#003b73] text-white flex items-center justify-center text-[10px] font-semibold">
                            {initials(r.assignedMechanic.name)}
                          </div>
                          <span className="text-sm truncate max-w-[120px]">
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
                      {payers.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">
                          Sin cargar
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {payers.map((p) => (
                            <span
                              key={p}
                              className="text-[9px] uppercase tracking-wider font-medium rounded border px-1 py-px bg-emerald-50 border-emerald-200 text-emerald-700"
                            >
                              {PAYER_LABEL[p]}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {r.budgetsTotal !== null && (
                        <div className="text-xs text-slate-500 tabular-nums">
                          Ppto {ARS.format(r.budgetsTotal)}
                        </div>
                      )}
                      {r.approvedTotal !== null && (
                        <div className="text-sm font-semibold text-emerald-700 tabular-nums">
                          {ARS.format(r.approvedTotal)}
                        </div>
                      )}
                      {r.pendingAmount !== null && r.pendingAmount > 0 && (
                        <div className="text-[10px] font-medium text-rose-600 tabular-nums">
                          Pend. {ARS.format(r.pendingAmount)}
                        </div>
                      )}
                      {r.budgetsTotal === null && r.approvedTotal === null && (
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
                );
              })}
            </TableBody>
          </Table>
        </div>
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
