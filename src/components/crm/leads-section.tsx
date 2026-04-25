"use client";

import {
  ArrowUpDown,
  Clock,
  Globe,
  Info,
  MessageCircle,
  Plus,
  Search,
  Tag,
  UserPlus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import BudgetModal from "./budget-modal";
import CustomerSelector, { type Customer } from "./customer-selector";
import { LeadCanvas } from "./lead-canvas";
import { type KanbanLead, LeadsKanban } from "./leads-kanban";
import VehicleForm from "./vehicle-form";

type LeadStatus =
  | "solicitud"
  | "control"
  | "enviado"
  | "refuerzo"
  | "ganado"
  | "perdido";

type BudgetLite = {
  id: string;
  number: number;
  status: string;
  grandTotal: string | number;
  updatedAt: string;
};

type Actor = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

type RepairStatusLite =
  | "turno_asignado"
  | "ingresado"
  | "repuestos_recibidos"
  | "chapa"
  | "pintura"
  | "calidad"
  | "experiencia_cliente"
  | "archivado";

type RepairOnLead = {
  id: string;
  status: RepairStatusLite;
  updatedAt: string;
};

type Lead = {
  id: string;
  status: LeadStatus;
  notes: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; email: string; phone: string };
  vehicle: {
    id: string;
    brand: string;
    model: string;
    year: string;
    domain: string;
  } | null;
  inspector: Actor | null;
  insuranceAgent: Actor | null;
  budgets: BudgetLite[];
  repairs: RepairOnLead[];
};

type PeriodFilter = "all" | "7d" | "30d" | "90d";
type SortBy = "recent" | "oldest" | "amount_desc" | "name_asc";

export default function LeadsSection() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");

  // Estado del dialog "Nuevo Lead"
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  // Modo del selector de cliente: existente (busca) o nuevo (form inline)
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    "existing",
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  // Form para cliente nuevo (solo campos esenciales — el resto usa defaults server-side)
  const [newCustName, setNewCustName] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustDniType, setNewCustDniType] = useState("DNI");
  const [newCustDni, setNewCustDni] = useState("");
  const [useExistingVehicle, setUseExistingVehicle] = useState<
    string | "new" | ""
  >("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleInsurance, setVehicleInsurance] = useState("");
  const [vehicleThirdPartyInsurance, setVehicleThirdPartyInsurance] =
    useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [creatingLead, setCreatingLead] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Estado del BudgetModal por fila
  const [budgetFor, setBudgetFor] = useState<string | null>(null);
  // Canvas lateral: leadId abierto (null = cerrado)
  const [canvasLeadId, setCanvasLeadId] = useState<string | null>(null);
  // Contador para forzar refetch del canvas sin cerrarlo (ej: después de guardar presupuesto)
  const [canvasReloadNonce, setCanvasReloadNonce] = useState(0);

  const fetchLeads = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/crm/leads`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { leads: Lead[] };
      setLeads(data.leads);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setLoadError(e instanceof Error ? e.message : "Error al cargar leads");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetchLeads(ac.signal);
    return () => ac.abort();
  }, [fetchLeads]);

  const filteredLeads = useMemo(() => {
    const t = searchTerm.toLowerCase();
    const now = Date.now();
    const periodMs: Record<PeriodFilter, number> = {
      all: Number.POSITIVE_INFINITY,
      "7d": 7 * 86400_000,
      "30d": 30 * 86400_000,
      "90d": 90 * 86400_000,
    };
    const cutoff = now - periodMs[periodFilter];

    const filtered = leads.filter((lead) => {
      if (sourceFilter !== "all" && (lead.source ?? "manual") !== sourceFilter)
        return false;
      if (periodFilter !== "all" && new Date(lead.createdAt).getTime() < cutoff)
        return false;
      if (t) {
        const matches =
          lead.customer.name.toLowerCase().includes(t) ||
          lead.customer.email.toLowerCase().includes(t) ||
          (lead.vehicle &&
            `${lead.vehicle.brand} ${lead.vehicle.model} ${lead.vehicle.domain}`
              .toLowerCase()
              .includes(t));
        if (!matches) return false;
      }
      return true;
    });

    const amountOf = (l: Lead) => Number(l.budgets[0]?.grandTotal ?? 0);
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return (
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          );
        case "amount_desc":
          return amountOf(b) - amountOf(a);
        case "name_asc":
          return a.customer.name.localeCompare(b.customer.name, "es");
        default:
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
      }
    });
    return sorted;
  }, [leads, searchTerm, sourceFilter, periodFilter, sortBy]);

  const activeFiltersCount =
    (sourceFilter !== "all" ? 1 : 0) +
    (periodFilter !== "all" ? 1 : 0) +
    (searchTerm ? 1 : 0);

  const clearFilters = () => {
    setSourceFilter("all");
    setPeriodFilter("all");
    setSearchTerm("");
    setSortBy("recent");
  };

  const resetNewLeadForm = () => {
    setCustomerMode("existing");
    setSelectedCustomer(null);
    setNewCustName("");
    setNewCustEmail("");
    setNewCustPhone("");
    setNewCustDniType("DNI");
    setNewCustDni("");
    setUseExistingVehicle("");
    setVehicleBrand("");
    setVehicleModel("");
    setVehicleYear("");
    setVehiclePlate("");
    setVehicleInsurance("");
    setVehicleThirdPartyInsurance("");
    setLeadNotes("");
    setCreateError(null);
  };

  const handleStatusChange = async (leadId: string, next: LeadStatus) => {
    // Update optimista — revertimos con un reload si el backend falla.
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, status: next, updatedAt: new Date().toISOString() }
          : l,
      ),
    );
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      await fetchLeads();
    }
  };

  const handleAssignActor = async (
    leadId: string,
    kind: "inspector" | "insurance",
    userId: string | null,
  ) => {
    const payload =
      kind === "inspector"
        ? { inspectorId: userId }
        : { insuranceAgentId: userId };
    // Con include en el PATCH recibimos la lead actualizada con los actores.
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { lead: Lead };
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, ...data.lead } : l)),
      );
    } catch {
      await fetchLeads();
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("¿Eliminar esta cotización?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      await fetchLeads();
    }
  };

  const handleCreateLead = async () => {
    setCreateError(null);

    const payload: Record<string, unknown> = {
      notes: leadNotes || null,
      source: "manual",
    };

    // Rama 1: cliente existente
    if (customerMode === "existing") {
      if (!selectedCustomer) {
        setCreateError("Seleccioná un cliente.");
        return;
      }
      payload.customerId = selectedCustomer.id;
    } else {
      // Rama 2: cliente nuevo
      if (!newCustName.trim() || !newCustEmail.trim() || !newCustPhone.trim()) {
        setCreateError("Completá nombre, email y teléfono del cliente nuevo.");
        return;
      }
      // Validación básica de email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustEmail.trim())) {
        setCreateError("El email del cliente no tiene un formato válido.");
        return;
      }
      payload.newCustomer = {
        name: newCustName.trim(),
        email: newCustEmail.trim(),
        phone: newCustPhone.trim(),
        dni: newCustDni.trim() || undefined,
        dniType: newCustDni.trim() ? newCustDniType : undefined,
      };
    }

    // Vehículo: existente (solo rama 1) o nuevo
    const creatingNewCustomer = customerMode === "new";
    if (creatingNewCustomer || useExistingVehicle === "new") {
      if (!vehicleBrand || !vehicleModel || !vehicleYear || !vehiclePlate) {
        setCreateError("Completá marca, modelo, año y patente del vehículo.");
        return;
      }
      payload.newVehicle = {
        brand: vehicleBrand,
        model: vehicleModel,
        year: vehicleYear,
        domain: vehiclePlate,
        secure: vehicleInsurance,
        thirdPartySecure: vehicleThirdPartyInsurance,
      };
    } else if (useExistingVehicle) {
      payload.vehicleId = useExistingVehicle;
    } else {
      setCreateError("Seleccioná o cargá un vehículo.");
      return;
    }

    setCreatingLead(true);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Error" }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      resetNewLeadForm();
      setShowNewLeadDialog(false);
      await fetchLeads();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Error al crear lead");
    } finally {
      setCreatingLead(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Cotizaciones" }]} />
          <h1 className="text-3xl font-bold text-foreground">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestioná el embudo de cotizaciones en curso
          </p>
        </div>
        <Dialog
          open={showNewLeadDialog}
          onOpenChange={(v) => {
            setShowNewLeadDialog(v);
            if (!v) resetNewLeadForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Cotización
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nueva cotización</DialogTitle>
              <DialogDescription>
                Seleccioná cliente y vehículo. El presupuesto lo cargás después
                desde la tarjeta de la cotización.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4">
              {/* Segmented control: cliente existente vs nuevo */}
              <div className="space-y-3">
                <Label>Cliente *</Label>
                <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setCustomerMode("existing")}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                      customerMode === "existing"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Cliente existente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode("new");
                      setSelectedCustomer(null);
                      // Al pasar a "nuevo", el vehículo siempre es nuevo
                      setUseExistingVehicle("new");
                    }}
                    className={`px-3 py-1.5 text-sm font-medium rounded transition-colors inline-flex items-center gap-1.5 ${
                      customerMode === "new"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Cliente nuevo
                  </button>
                </div>

                {customerMode === "existing" ? (
                  <CustomerSelector
                    selectedCustomer={selectedCustomer}
                    onCustomerSelect={(c) => {
                      setSelectedCustomer(c);
                      setUseExistingVehicle(c?.vehicles?.[0]?.id ?? "new");
                    }}
                  />
                ) : (
                  <div className="grid gap-3 rounded-md border border-dashed bg-muted/10 p-4">
                    <p className="text-xs text-muted-foreground -mt-1">
                      Datos esenciales. La dirección completa se completa con
                      valores por defecto (Argentina · Santa Fe · Rafaela) y se
                      puede editar después desde Clientes.
                    </p>
                    <div className="grid gap-2">
                      <Label htmlFor="newCustName">Nombre completo *</Label>
                      <Input
                        id="newCustName"
                        placeholder="Apellido, Nombre"
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="newCustEmail">Email *</Label>
                        <Input
                          id="newCustEmail"
                          type="email"
                          placeholder="cliente@email.com"
                          value={newCustEmail}
                          onChange={(e) => setNewCustEmail(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="newCustPhone">Teléfono *</Label>
                        <Input
                          id="newCustPhone"
                          placeholder="+54 9 3492 155-9075"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-[120px_1fr] gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="newCustDniType">Doc.</Label>
                        <Select
                          value={newCustDniType}
                          onValueChange={setNewCustDniType}
                        >
                          <SelectTrigger id="newCustDniType">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DNI">DNI</SelectItem>
                            <SelectItem value="CUIL">CUIL</SelectItem>
                            <SelectItem value="CUIT">CUIT</SelectItem>
                            <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="newCustDni">Número</Label>
                        <Input
                          id="newCustDni"
                          placeholder="12345678 (opcional)"
                          value={newCustDni}
                          onChange={(e) => setNewCustDni(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Selector de vehículo existente — solo si hay cliente existente */}
              {customerMode === "existing" && selectedCustomer && (
                <div className="space-y-3">
                  <Label>Vehículo</Label>
                  <Select
                    value={useExistingVehicle}
                    onValueChange={(v) => setUseExistingVehicle(v as string)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar vehículo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCustomer.vehicles?.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.brand} {v.model} {v.year} — {v.domain}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">+ Vehículo nuevo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Form de vehículo nuevo: siempre en modo "cliente nuevo", o cuando el user elige "+ Vehículo nuevo" con cliente existente */}
              {(customerMode === "new" || useExistingVehicle === "new") && (
                <VehicleForm
                  brand={vehicleBrand}
                  model={vehicleModel}
                  year={vehicleYear}
                  plate={vehiclePlate}
                  insurance={vehicleInsurance}
                  thirdPartyInsurance={vehicleThirdPartyInsurance}
                  onBrandChange={setVehicleBrand}
                  onModelChange={setVehicleModel}
                  onYearChange={setVehicleYear}
                  onPlateChange={setVehiclePlate}
                  onInsuranceChange={setVehicleInsurance}
                  onThirdPartyInsuranceChange={setVehicleThirdPartyInsurance}
                />
              )}

              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Info className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold">Información Adicional</h3>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notas adicionales</Label>
                  <Textarea
                    id="notes"
                    placeholder="Observaciones, detalles específicos..."
                    rows={3}
                    value={leadNotes}
                    onChange={(e) => setLeadNotes(e.target.value)}
                  />
                </div>
              </div>

              {createError && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {createError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowNewLeadDialog(false)}
                disabled={creatingLead}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateLead} disabled={creatingLead}>
                {creatingLead ? "Creando..." : "Crear cotización"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Buscar por nombre, email, patente o modelo…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        {/* Fuente — pills */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shrink-0">
          <Tag className="h-3.5 w-3.5 text-slate-400 mx-1.5 shrink-0" />
          <FilterPill
            active={sourceFilter === "all"}
            onClick={() => setSourceFilter("all")}
          >
            Todas
          </FilterPill>
          <FilterPill
            active={sourceFilter === "web"}
            onClick={() => setSourceFilter("web")}
            icon={Globe}
          >
            Web
          </FilterPill>
          <FilterPill
            active={sourceFilter === "whatsapp"}
            onClick={() => setSourceFilter("whatsapp")}
            icon={MessageCircle}
          >
            WhatsApp
          </FilterPill>
          <FilterPill
            active={sourceFilter === "manual"}
            onClick={() => setSourceFilter("manual")}
            icon={UserPlus}
          >
            Manual
          </FilterPill>
        </div>

        {/* Período — pills compactos */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shrink-0">
          <Clock className="h-3.5 w-3.5 text-slate-400 mx-1.5 shrink-0" />
          <FilterPill
            active={periodFilter === "all"}
            onClick={() => setPeriodFilter("all")}
          >
            Todo
          </FilterPill>
          <FilterPill
            active={periodFilter === "7d"}
            onClick={() => setPeriodFilter("7d")}
          >
            7d
          </FilterPill>
          <FilterPill
            active={periodFilter === "30d"}
            onClick={() => setPeriodFilter("30d")}
          >
            30d
          </FilterPill>
          <FilterPill
            active={periodFilter === "90d"}
            onClick={() => setPeriodFilter("90d")}
          >
            90d
          </FilterPill>
        </div>

        {/* Sort + limpiar */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-44 bg-white">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Más recientes</SelectItem>
              <SelectItem value="oldest">Más antiguos</SelectItem>
              <SelectItem value="amount_desc">Mayor importe</SelectItem>
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

      {/* Kanban */}
      <LeadsKanban
        leads={filteredLeads as unknown as KanbanLead[]}
        loading={loading}
        onStatusChange={handleStatusChange}
        onAssignActor={handleAssignActor}
        onOpenDetail={(lead) => setCanvasLeadId(lead.id)}
        onOpenBudget={(leadId) => setBudgetFor(leadId)}
        onDelete={handleDeleteLead}
      />

      {/* Budget modal (controlado) */}
      <BudgetModal
        leadId={budgetFor ?? undefined}
        hideTrigger
        open={budgetFor !== null}
        onOpenChange={(v) => {
          if (!v) setBudgetFor(null);
        }}
        onSaved={() => {
          setBudgetFor(null);
          fetchLeads();
          // Si el canvas sigue abierto, al volver de estar suppressed se va a
          // refetchear solo (bumpeamos la nonce para asegurar datos frescos).
          if (canvasLeadId) setCanvasReloadNonce((n) => n + 1);
        }}
      />

      {/* Canvas lateral de detalle. Mientras el BudgetModal está abierto lo
          suprimimos (Sheet hidden) para que el dialog fullscreen tenga todo
          el ancho disponible. Al cerrar el modal el canvas vuelve. */}
      <LeadCanvas
        leadId={canvasLeadId}
        onClose={() => setCanvasLeadId(null)}
        onChanged={() => fetchLeads()}
        reloadNonce={canvasReloadNonce}
        suppressed={budgetFor !== null}
        onOpenBudget={(leadId) => setBudgetFor(leadId)}
      />
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-[#003b73] text-white shadow-xs"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </button>
  );
}
