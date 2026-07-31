"use client";

import {
  AlertCircle,
  ArrowUpDown,
  Loader2,
  Plus,
  Search,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import CustomerSelector, {
  type Customer,
} from "@/components/crm/customer-selector";
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
import {
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

/** `YYYY-MM-DDTHH:mm` (datetime-local) interpretado como hora LOCAL del
 *  navegador → ISO UTC. Sin este helper, mandar el string tal cual hace
 *  que el server (UTC en producción) lo parsee como si la hora fuera UTC. */
function parseLocalDateTimeInput(v: string): string | null {
  if (!v) return null;
  const [datePart, timePart] = v.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0).toISOString();
}

/** `YYYY-MM-DD` → ISO al mediodía LOCAL (evita saltos de día por UTC). */
function parseLocalDateInput(v: string): string | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export default function ProductionSection() {
  const [repairs, setRepairs] = useState<KanbanRepair[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [mechanicFilter, setMechanicFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");

  // Mecánicos disponibles para filtro + dialog nueva reparación
  const [mechanics, setMechanics] = useState<MechanicOption[]>([]);

  // Canvas lateral: repairId abierto (null = cerrado)
  const [canvasRepairId, setCanvasRepairId] = useState<string | null>(null);

  // Dialog Nueva Reparación
  const [showNewDialog, setShowNewDialog] = useState(false);
  // Modo del selector de cliente: existente (busca) o nuevo (form inline)
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    "existing",
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | "new">(
    "",
  );
  // Form para cliente nuevo
  const [newCustName, setNewCustName] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustDniType, setNewCustDniType] = useState("DNI");
  const [newCustDni, setNewCustDni] = useState("");
  // Form para vehículo nuevo
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleInsurance, setVehicleInsurance] = useState("");
  const [vehicleThirdPartyInsurance, setVehicleThirdPartyInsurance] =
    useState("");

  const [reason, setReason] = useState("");
  const [newMechanicId, setNewMechanicId] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [estimatedDeliveryAt, setEstimatedDeliveryAt] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
  }, [repairs, searchTerm, mechanicFilter, sortBy]);

  const activeFiltersCount =
    (mechanicFilter !== "all" ? 1 : 0) + (searchTerm ? 1 : 0);

  const clearFilters = () => {
    setMechanicFilter("all");
    setSearchTerm("");
    setSortBy("recent");
  };

  const resetNewForm = () => {
    setCustomerMode("existing");
    setSelectedCustomer(null);
    setSelectedVehicleId("");
    setNewCustName("");
    setNewCustEmail("");
    setNewCustPhone("");
    setNewCustDniType("DNI");
    setNewCustDni("");
    setVehicleBrand("");
    setVehicleModel("");
    setVehicleYear("");
    setVehiclePlate("");
    setVehicleInsurance("");
    setVehicleThirdPartyInsurance("");
    setReason("");
    setNewMechanicId("");
    setScheduledAt("");
    setEstimatedDeliveryAt("");
    setNotes("");
    setCreateError(null);
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

  const handleCreate = async () => {
    setCreateError(null);

    const payload: Record<string, unknown> = {
      reason: reason.trim() || null,
      assignedMechanicId: newMechanicId || null,
      // spec 2.1 v2 · Parseamos la fecha/hora como LOCAL del navegador
      // antes de mandarla — sin esto, el server (UTC en producción) toma
      // la hora como UTC y el mail sale desfasado (bug reportado: turno
      // cargado a las 8 AM AR mostraba "12:00 a. m.").
      scheduledAt: parseLocalDateTimeInput(scheduledAt),
      estimatedDeliveryAt: parseLocalDateInput(estimatedDeliveryAt),
      notes: notes.trim() || null,
    };

    if (customerMode === "existing") {
      if (!selectedCustomer) {
        setCreateError("Seleccioná un cliente.");
        return;
      }
      payload.customerId = selectedCustomer.id;

      // Vehículo: existente o nuevo (para cliente existente)
      if (selectedVehicleId === "new") {
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
      } else if (selectedVehicleId) {
        payload.vehicleId = selectedVehicleId;
      } else if (
        !selectedCustomer.vehicles ||
        selectedCustomer.vehicles.length === 0
      ) {
        setCreateError(
          "El cliente no tiene vehículos cargados. Cargá uno nuevo.",
        );
        return;
      }
    } else {
      // Cliente nuevo
      if (!newCustName.trim() || !newCustEmail.trim() || !newCustPhone.trim()) {
        setCreateError("Completá nombre, email y teléfono del cliente nuevo.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustEmail.trim())) {
        setCreateError("El email del cliente no tiene un formato válido.");
        return;
      }
      if (!vehicleBrand || !vehicleModel || !vehicleYear || !vehiclePlate) {
        setCreateError("Completá marca, modelo, año y patente del vehículo.");
        return;
      }
      payload.newCustomer = {
        name: newCustName.trim(),
        email: newCustEmail.trim(),
        phone: newCustPhone.trim(),
        dni: newCustDni.trim() || undefined,
        dniType: newCustDni.trim() ? newCustDniType : undefined,
      };
      payload.newVehicle = {
        brand: vehicleBrand,
        model: vehicleModel,
        year: vehicleYear,
        domain: vehiclePlate,
        secure: vehicleInsurance,
        thirdPartySecure: vehicleThirdPartyInsurance,
      };
    }

    setCreating(true);
    try {
      const res = await fetch("/api/repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      resetNewForm();
      setShowNewDialog(false);
      await fetchRepairs();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Error al crear");
    } finally {
      setCreating(false);
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

        <Dialog
          open={showNewDialog}
          onOpenChange={(v) => {
            setShowNewDialog(v);
            if (!v) resetNewForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Reparación
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-[#003b73]" />
                Nueva Reparación
              </DialogTitle>
              <DialogDescription>
                Crea una reparación directa sin pasar por el módulo de
                cotizaciones. Ideal para trabajos rápidos o clientes existentes
                que ingresan al taller.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              {/* Segmented control: cliente existente vs nuevo */}
              <div className="space-y-2">
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
                      setSelectedVehicleId("new");
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
                      setSelectedVehicleId(c?.vehicles?.[0]?.id ?? "new");
                    }}
                  />
                ) : (
                  <div className="grid gap-3 rounded-md border border-dashed bg-muted/10 p-4">
                    <p className="text-xs text-muted-foreground -mt-1">
                      Datos esenciales. La dirección completa se completa con
                      defaults (Argentina · Santa Fe · Rafaela).
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

              {/* Vehículo: solo selector si cliente existente con vehículos */}
              {customerMode === "existing" &&
                selectedCustomer?.vehicles &&
                selectedCustomer.vehicles.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="vehicleSel">Vehículo *</Label>
                    <Select
                      value={selectedVehicleId}
                      onValueChange={(v) =>
                        setSelectedVehicleId(v as string | "new")
                      }
                    >
                      <SelectTrigger id="vehicleSel">
                        <SelectValue placeholder="Elegí un vehículo…" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedCustomer.vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.brand} {v.model} {v.year} — {v.domain}
                          </SelectItem>
                        ))}
                        <SelectItem value="new">+ Vehículo nuevo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

              {/* Form vehículo nuevo: cuando cliente nuevo, o cuando cliente
                  existente sin vehículos, o cuando elige "+ Vehículo nuevo" */}
              {(customerMode === "new" ||
                selectedVehicleId === "new" ||
                (customerMode === "existing" &&
                  selectedCustomer &&
                  (!selectedCustomer.vehicles ||
                    selectedCustomer.vehicles.length === 0))) && (
                <div className="grid gap-3 rounded-md border border-dashed bg-muted/10 p-4">
                  <p className="text-xs text-muted-foreground -mt-1 font-medium">
                    Datos del vehículo
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="vbrand">Marca *</Label>
                      <Input
                        id="vbrand"
                        placeholder="Toyota"
                        value={vehicleBrand}
                        onChange={(e) => setVehicleBrand(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vmodel">Modelo *</Label>
                      <Input
                        id="vmodel"
                        placeholder="Corolla"
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="vyear">Año *</Label>
                      <Input
                        id="vyear"
                        placeholder="2024"
                        value={vehicleYear}
                        onChange={(e) => setVehicleYear(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vplate">Patente *</Label>
                      <Input
                        id="vplate"
                        placeholder="AA 123 BC"
                        value={vehiclePlate}
                        onChange={(e) =>
                          setVehiclePlate(e.target.value.toUpperCase())
                        }
                        className="font-mono uppercase"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="vins">Seguro</Label>
                      <Input
                        id="vins"
                        placeholder="Aseguradora"
                        value={vehicleInsurance}
                        onChange={(e) => setVehicleInsurance(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vinst">Seguro del tercero</Label>
                      <Input
                        id="vinst"
                        placeholder="Aseguradora del tercero"
                        value={vehicleThirdPartyInsurance}
                        onChange={(e) =>
                          setVehicleThirdPartyInsurance(e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="reason">Motivo de ingreso</Label>
                <Textarea
                  id="reason"
                  rows={2}
                  placeholder="Ej: Choque trasero, cambio de paragolpes y óptica derecha…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="scheduledAt">
                    Turno asignado (fecha y hora)
                  </Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="estimatedDeliveryAt">Entrega estimada</Label>
                  <Input
                    id="estimatedDeliveryAt"
                    type="date"
                    value={estimatedDeliveryAt}
                    onChange={(e) => setEstimatedDeliveryAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mechanicSel">Mecánico asignado</Label>
                <Select
                  value={newMechanicId || "__none__"}
                  onValueChange={(v) =>
                    setNewMechanicId(v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger id="mechanicSel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {mechanics.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name ?? m.email ?? m.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notesField">Notas internas</Label>
                <Textarea
                  id="notesField"
                  rows={2}
                  placeholder="Observaciones…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {createError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowNewDialog(false)}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creando…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Crear reparación
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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

      <ProductionKanban
        repairs={filteredRepairs}
        loading={loading}
        onStatusChange={handleStatusChange}
        onOpenDetail={(r) => setCanvasRepairId(r.id)}
        onDelete={handleDelete}
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
