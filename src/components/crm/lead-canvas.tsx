"use client";

import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Car,
  Check,
  FileText,
  Hash,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Send,
  Shield,
  Trash2,
  User as UserIcon,
  Users,
  Wrench,
  X as XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { SendBudgetDialog } from "./send-budget-dialog";
import { BrandField, ModelField, YearField } from "./vehicle-fields";

type LeadStatus =
  | "solicitud"
  | "control"
  | "enviado"
  | "refuerzo"
  | "ganado"
  | "perdido";

type LeadLostReason =
  | "precio"
  | "demora"
  | "no_respondio"
  | "competencia"
  | "otro";

type UserLite = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

type InsuranceCompanyLite = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  contactName: string | null;
};

type VehicleDetail = {
  id: string;
  brand: string;
  model: string;
  year: string;
  domain: string;
  secure: string;
  thirdPartySecure: string;
};

type CustomerDetail = {
  id: string;
  name: string;
  email: string;
  phone: string;
  dni: string | null;
  dniType: string | null;
};

type BudgetLite = {
  id: string;
  number: number;
  status: string;
  grandTotal: string | number;
  updatedAt: string;
  sentAt: string | null;
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

type RepairLite = {
  id: string;
  status: RepairStatusLite;
  directCreation: boolean;
  budgetId: string | null;
  assignedMechanic: UserLite | null;
  scheduledAt: string | null;
  enteredAt: string | null;
  partsReceivedAt: string | null;
  estimatedDeliveryAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
};

type LeadDetail = {
  id: string;
  status: LeadStatus;
  notes: string | null;
  lostReason: LeadLostReason | null;
  lostNotes: string | null;
  customer: CustomerDetail;
  vehicle: VehicleDetail | null;
  inspector: UserLite | null;
  insuranceAgent: UserLite | null;
  insuranceCompany: InsuranceCompanyLite | null;
  budgets: BudgetLite[];
  repairs: RepairLite[];
};

type Insurance = { id: string; name: string };

const STATUS_LABELS: Record<LeadStatus, string> = {
  solicitud: "Solicitud",
  control: "Control",
  enviado: "Enviado",
  refuerzo: "Refuerzo",
  ganado: "Ganado",
  perdido: "Perdido",
};

const STATUS_DOT: Record<LeadStatus, string> = {
  solicitud: "bg-slate-500",
  control: "bg-blue-500",
  enviado: "bg-cyan-500",
  refuerzo: "bg-purple-500",
  ganado: "bg-emerald-500",
  perdido: "bg-rose-500",
};

const LOST_REASONS: Array<{ key: LeadLostReason; label: string }> = [
  { key: "precio", label: "Precio" },
  { key: "demora", label: "Demora" },
  { key: "no_respondio", label: "No respondió" },
  { key: "competencia", label: "Competencia" },
  { key: "otro", label: "Otro" },
];

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

type Props = {
  leadId: string | null;
  onClose: () => void;
  /** Llamada cuando el lead se modifica, para que el kanban refresque. */
  onChanged?: () => void;
  /** Llamada cuando piden abrir un presupuesto del lead. */
  onOpenBudget?: (leadId: string) => void;
  /**
   * Incrementá este valor desde afuera para forzar un refetch del detalle
   * (ej: después de guardar un presupuesto sin cerrar el canvas).
   */
  reloadNonce?: number;
  /**
   * Si está en true, el Sheet se oculta sin perder el estado (lead, draft,
   * scroll). Se usa cuando abrimos un modal encima que necesita ancho completo
   * (ej: el BudgetModal).
   */
  suppressed?: boolean;
};

export function LeadCanvas({
  leadId,
  onClose,
  onChanged,
  onOpenBudget,
  reloadNonce,
  suppressed = false,
}: Props) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingIndicator, setSavingIndicator] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  // Presupuesto que se está por enviar por email
  const [sendingBudget, setSendingBudget] = useState<BudgetLite | null>(null);
  // Contador interno para refetch después de enviar (no pisa el reloadNonce externo)
  const [internalReload, setInternalReload] = useState(0);

  const markSaving = useCallback(() => setSavingIndicator("saving"), []);
  const markSaved = useCallback(() => {
    setSavingIndicator("saved");
    setTimeout(() => setSavingIndicator("idle"), 1500);
  }, []);

  // Carga de detalle al abrir y cuando se bumpea reloadNonce desde afuera
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadNonce es un trigger deliberado para forzar refetch
  useEffect(() => {
    if (!leadId) {
      setLead(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/crm/leads/${leadId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((body) => {
        if (!cancelled) setLead(body.lead as LeadDetail);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, reloadNonce, internalReload]);

  // Helpers de PATCH ────────────────────────────────────────────
  const patchLead = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!leadId) return;
      markSaving();
      try {
        const res = await fetch(`/api/crm/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const body = await res.json();
        setLead((prev) =>
          prev ? { ...prev, ...(body.lead as Partial<LeadDetail>) } : prev,
        );
        markSaved();
        onChanged?.();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Error al guardar");
        setSavingIndicator("idle");
      }
    },
    [leadId, markSaving, markSaved, onChanged],
  );

  const patchCustomer = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!lead) return;
      markSaving();
      try {
        const res = await fetch(`/api/customers/${lead.customer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        setLead((prev) =>
          prev
            ? {
                ...prev,
                customer: { ...prev.customer, ...patch } as CustomerDetail,
              }
            : prev,
        );
        markSaved();
        onChanged?.();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Error al guardar cliente");
        setSavingIndicator("idle");
      }
    },
    [lead, markSaving, markSaved, onChanged],
  );

  const patchVehicle = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!lead?.vehicle) return;
      markSaving();
      try {
        const res = await fetch(`/api/customer-vehicles/${lead.vehicle.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        setLead((prev) =>
          prev?.vehicle
            ? {
                ...prev,
                vehicle: { ...prev.vehicle, ...patch } as VehicleDetail,
              }
            : prev,
        );
        markSaved();
        onChanged?.();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Error al guardar vehículo");
        setSavingIndicator("idle");
      }
    },
    [lead, markSaving, markSaved, onChanged],
  );

  return (
    <Sheet
      open={leadId !== null && !suppressed}
      onOpenChange={(open) => {
        // Si estamos suppressed, ignorar intentos de Radix de cerrar:
        // la visibilidad la controla 100% el parent.
        if (suppressed) return;
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="p-0 bg-slate-50/60"
        showCloseButton={false}
      >
        {/* SheetTitle siempre presente para a11y (screen readers). Cuando
            el lead carga se muestra visualmente; mientras tanto queda sr-only. */}
        {!lead && <SheetTitle className="sr-only">Detalle del lead</SheetTitle>}

        {loading && !lead && (
          <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
          </div>
        )}

        {loadError && (
          <div className="p-6">
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              {loadError}
            </div>
          </div>
        )}

        {lead && (
          <>
            {/* Header con gradiente y avatar */}
            <SheetHeader className="relative bg-linear-to-br from-[#003b73] to-[#0056a8] text-white p-5 pr-14 border-b-0 gap-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="absolute top-3 right-3 h-8 w-8 rounded-md hover:bg-white/15 flex items-center justify-center transition-colors"
              >
                <XIcon className="h-4 w-4" />
              </button>

              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-white/15 ring-2 ring-white/30 flex items-center justify-center text-base font-semibold shrink-0">
                  {getInitials(lead.customer.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-white text-lg truncate">
                    {lead.customer.name}
                  </SheetTitle>
                  {lead.vehicle && (
                    <SheetDescription className="text-white/80 flex items-center gap-1.5 mt-1 text-xs">
                      <Car className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {lead.vehicle.brand} {lead.vehicle.model}{" "}
                        {lead.vehicle.year}
                      </span>
                      <span className="font-mono bg-white/15 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
                        {lead.vehicle.domain}
                      </span>
                    </SheetDescription>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-2.5 py-1 text-[11px] font-medium`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[lead.status]}`}
                  />
                  {STATUS_LABELS[lead.status]}
                </span>
                <SavingIndicator state={savingIndicator} />
              </div>
            </SheetHeader>

            {/* Body scrollable con secciones como cards */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              <ActorsSection
                leadId={lead.id}
                inspector={lead.inspector}
                insuranceAgent={lead.insuranceAgent}
                insuranceCompany={lead.insuranceCompany}
                onChange={(kind, userId) =>
                  patchLead({
                    [kind === "inspector" ? "inspectorId" : "insuranceAgentId"]:
                      userId,
                  })
                }
                onChangeCompany={(companyId) =>
                  patchLead({ insuranceCompanyId: companyId })
                }
              />

              {lead.vehicle && (
                <VehicleSection vehicle={lead.vehicle} onPatch={patchVehicle} />
              )}

              <CustomerSection
                customer={lead.customer}
                onPatch={patchCustomer}
              />

              <NotesSection
                value={lead.notes ?? ""}
                onSave={(notes) => patchLead({ notes: notes || null })}
              />

              <BudgetsSection
                leadId={lead.id}
                budgets={lead.budgets}
                onOpenBudget={onOpenBudget}
                onSendBudget={(b) => setSendingBudget(b)}
              />

              {lead.repairs.length > 0 && (
                <RepairSection repairs={lead.repairs} />
              )}

              <StatusSection
                status={lead.status}
                lostReason={lead.lostReason}
                lostNotes={lead.lostNotes}
                onChangeStatus={(status) => patchLead({ status })}
                onChangeLostReason={(lostReason) => patchLead({ lostReason })}
                onChangeLostNotes={(lostNotes) =>
                  patchLead({ lostNotes: lostNotes || null })
                }
              />
            </div>
          </>
        )}
      </SheetContent>

      {/* Dialog de envio de presupuesto por email — fuera del Sheet para
          que tenga su propio overlay y no interfiera. */}
      <SendBudgetDialog
        open={sendingBudget !== null}
        onOpenChange={(v) => {
          if (!v) setSendingBudget(null);
        }}
        budgetId={sendingBudget?.id ?? null}
        budgetNumber={sendingBudget?.number}
        customer={{
          name: lead?.customer.name ?? "",
          email: lead?.customer.email ?? "",
        }}
        inspector={lead?.inspector ?? null}
        insuranceAgent={lead?.insuranceAgent ?? null}
        onSent={() => {
          // Refresca el canvas para ver el nuevo status y sentAt del budget
          setInternalReload((n) => n + 1);
          onChanged?.();
        }}
      />
    </Sheet>
  );
}

function getInitials(name: string | null | undefined): string {
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

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "hace unos segundos";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} día${d === 1 ? "" : "s"}`;
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// Secciones
// ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  iconTint = "text-slate-500",
  iconBg = "bg-slate-100",
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  iconTint?: string;
  iconBg?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <div
          className={`h-6 w-6 rounded-md ${iconBg} flex items-center justify-center`}
        >
          <Icon className={`h-3.5 w-3.5 ${iconTint}`} />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          {title}
        </h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ActorsSection({
  leadId: _leadId,
  inspector,
  insuranceAgent,
  insuranceCompany,
  onChange,
  onChangeCompany,
}: {
  leadId: string;
  inspector: UserLite | null;
  insuranceAgent: UserLite | null;
  insuranceCompany: InsuranceCompanyLite | null;
  onChange: (kind: "inspector" | "insurance", userId: string | null) => void;
  onChangeCompany: (companyId: string | null) => void;
}) {
  return (
    <SectionCard
      icon={Users}
      title="Actores"
      iconTint="text-indigo-600"
      iconBg="bg-indigo-50"
    >
      <div className="grid gap-2">
        <ActorRow
          label="Perito / Inspector"
          icon={Shield}
          accent="text-cyan-700"
          accentBg="bg-cyan-50"
          avatarBg="bg-cyan-600"
          roleKey="inspector"
          current={inspector}
          onPick={(userId) => onChange("inspector", userId)}
        />
        <ActorRow
          label="Productor de seguros"
          icon={Briefcase}
          accent="text-emerald-700"
          accentBg="bg-emerald-50"
          avatarBg="bg-emerald-600"
          roleKey="productor_seguros"
          current={insuranceAgent}
          onPick={(userId) => onChange("insurance", userId)}
        />
        <InsuranceCompanyRow
          current={insuranceCompany}
          onPick={onChangeCompany}
        />
      </div>
    </SectionCard>
  );
}

function ActorRow({
  label,
  icon: Icon,
  accent,
  accentBg,
  avatarBg,
  roleKey,
  current,
  onPick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  accentBg: string;
  avatarBg: string;
  roleKey: "inspector" | "productor_seguros";
  current: UserLite | null;
  onPick: (userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserLite[] | null>(null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"list" | "create">("list");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    setUsers(null);
    fetch(`/api/users?role=${roleKey}`)
      .then((r) => r.json())
      .then((body) => setUsers((body.users ?? []) as UserLite[]))
      .catch(() => setUsers([]));
  }, [roleKey]);

  useEffect(() => {
    if (!open || users !== null) return;
    fetchUsers();
  }, [open, users, fetchUsers]);

  useEffect(() => {
    if (!open) {
      setMode("list");
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setCreateError(null);
      setSearch("");
    }
  }, [open]);

  const submitCreate = async () => {
    setCreateError(null);
    if (!newName.trim() || !newEmail.trim()) {
      setCreateError("Completá nombre y email.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim() || null,
          roleName: roleKey,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      const created = body.user as UserLite;
      onPick(created.id);
      setOpen(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Error al crear");
    } finally {
      setCreating(false);
    }
  };

  const filtered = (users ?? []).filter((u) => {
    if (!search) return true;
    const t = search.toLowerCase();
    return (
      (u.name ?? "").toLowerCase().includes(t) ||
      (u.email ?? "").toLowerCase().includes(t)
    );
  });

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group">
      <div
        className={`h-9 w-9 rounded-lg ${accentBg} flex items-center justify-center shrink-0`}
      >
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        {current ? (
          <div className="flex items-center gap-2 mt-0.5">
            <div
              className={`h-5 w-5 rounded-full ${avatarBg} flex items-center justify-center text-[9px] font-semibold text-white shrink-0`}
            >
              {getInitials(current.name)}
            </div>
            <p className="text-sm font-medium text-slate-900 truncate">
              {current.name ?? current.email}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic mt-0.5">Sin asignar</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {current && (
          <button
            type="button"
            onClick={() => onPick(null)}
            title="Quitar asignación"
            className="h-7 w-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                current
                  ? "text-slate-600 hover:bg-slate-100 border border-slate-200"
                  : `${accent} ${accentBg} hover:brightness-95 border border-transparent`
              }`}
            >
              {current ? (
                "Cambiar"
              ) : (
                <>
                  <Plus className="h-3 w-3" /> Asignar
                </>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            {mode === "list" ? (
              <>
                <div className="p-2 border-b">
                  <Input
                    placeholder="Buscar por nombre o email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {users === null && (
                    <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin mr-2" />{" "}
                      Cargando…
                    </div>
                  )}
                  {users !== null && filtered.length === 0 && (
                    <p className="px-2 py-6 text-xs text-center text-muted-foreground italic">
                      {search
                        ? "Sin resultados"
                        : `Todavía no hay ${label.toLowerCase()} cargados.`}
                    </p>
                  )}
                  {filtered.map((u) => {
                    const isCurrent = current?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          if (isCurrent) return;
                          onPick(u.id);
                          setOpen(false);
                        }}
                        disabled={isCurrent}
                        className={`w-full flex items-center gap-2 px-2 py-2 text-xs rounded transition-colors ${
                          isCurrent ? "bg-muted/50" : "hover:bg-accent"
                        }`}
                      >
                        <div
                          className={`h-6 w-6 rounded-full ${avatarBg} flex items-center justify-center text-[10px] font-semibold text-white shrink-0`}
                        >
                          {getInitials(u.name)}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-medium truncate">
                            {u.name ?? "—"}
                          </p>
                          <p className="text-muted-foreground truncate">
                            {u.email}
                          </p>
                        </div>
                        {isCurrent && (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("create");
                      setCreateError(null);
                    }}
                    className={`w-full inline-flex items-center gap-2 px-2 py-2 text-xs font-medium rounded ${accent} hover:${accentBg} transition-colors`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Crear nuevo {label.toLowerCase()}
                  </button>
                </div>
              </>
            ) : (
              <div className="p-3 grid gap-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">
                    Nuevo {label.toLowerCase()}
                  </p>
                  <button
                    type="button"
                    onClick={() => setMode("list")}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Nombre
                  </Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Apellido, Nombre"
                    className="h-8 text-xs"
                    autoFocus
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="persona@email.com"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Celular
                  </Label>
                  <Input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+54 9 3492 155-9075"
                    className="h-8 text-xs"
                  />
                </div>
                {createError && (
                  <p className="text-[11px] text-rose-600">{createError}</p>
                )}
                <button
                  type="button"
                  onClick={submitCreate}
                  disabled={creating}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md ${accent} ${accentBg} hover:brightness-95 px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60`}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Creando…
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" /> Crear y asignar
                    </>
                  )}
                </button>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Se crea como contacto de referencia. No podrá loguearse hasta
                  que se le asigne una contraseña.
                </p>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4to actor: Compañía de Seguros (spec 8.1)
// Picker contra /api/insurance-companies + crear nueva inline.
// ─────────────────────────────────────────────────────────────

function InsuranceCompanyRow({
  current,
  onPick,
}: {
  current: InsuranceCompanyLite | null;
  onPick: (companyId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<InsuranceCompanyLite[] | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"list" | "create">("list");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchCompanies = useCallback(() => {
    setCompanies(null);
    fetch("/api/insurance-companies?active=1")
      .then((r) => r.json())
      .then((b) => setCompanies((b.companies ?? []) as InsuranceCompanyLite[]))
      .catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (!open || companies !== null) return;
    fetchCompanies();
  }, [open, companies, fetchCompanies]);

  useEffect(() => {
    if (!open) {
      setMode("list");
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewContactName("");
      setCreateError(null);
      setSearch("");
    }
  }, [open]);

  const submitCreate = async () => {
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError("El nombre es obligatorio.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/insurance-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim() || null,
          phone: newPhone.trim() || null,
          contactName: newContactName.trim() || null,
          isActive: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      const created = body.company as InsuranceCompanyLite;
      onPick(created.id);
      setOpen(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Error al crear");
    } finally {
      setCreating(false);
    }
  };

  const filtered = (companies ?? []).filter((c) => {
    if (!search) return true;
    return c.name.toLowerCase().includes(search.toLowerCase());
  });

  const accent = "text-amber-700";
  const accentBg = "bg-amber-50";
  const avatarBg = "bg-amber-600";

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group">
      <div
        className={`h-9 w-9 rounded-lg ${accentBg} flex items-center justify-center shrink-0`}
      >
        <Shield className={`h-4 w-4 ${accent}`} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Compañía de Seguros
        </p>
        {current ? (
          <div className="flex items-center gap-2 mt-0.5">
            <div
              className={`h-5 w-5 rounded-full ${avatarBg} flex items-center justify-center text-[9px] font-semibold text-white shrink-0`}
            >
              {getInitials(current.name)}
            </div>
            <p className="text-sm font-medium text-slate-900 truncate">
              {current.name}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic mt-0.5">Sin asignar</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {current && (
          <button
            type="button"
            onClick={() => onPick(null)}
            title="Quitar asignación"
            className="h-7 w-7 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                current
                  ? "text-slate-600 hover:bg-slate-100 border border-slate-200"
                  : `${accent} ${accentBg} hover:brightness-95 border border-transparent`
              }`}
            >
              {current ? (
                "Cambiar"
              ) : (
                <>
                  <Plus className="h-3 w-3" /> Asignar
                </>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            {mode === "list" ? (
              <>
                <div className="p-2 border-b">
                  <Input
                    placeholder="Buscar aseguradora…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {companies === null && (
                    <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      Cargando…
                    </div>
                  )}
                  {companies !== null && filtered.length === 0 && (
                    <p className="px-2 py-6 text-xs text-center text-muted-foreground italic">
                      {search
                        ? "Sin resultados"
                        : "Todavía no hay aseguradoras cargadas."}
                    </p>
                  )}
                  {filtered.map((c) => {
                    const isCurrent = current?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          if (isCurrent) return;
                          onPick(c.id);
                          setOpen(false);
                        }}
                        disabled={isCurrent}
                        className={`w-full flex items-center gap-2 px-2 py-2 text-xs rounded transition-colors ${
                          isCurrent ? "bg-muted/50" : "hover:bg-accent"
                        }`}
                      >
                        <div
                          className={`h-6 w-6 rounded-full ${avatarBg} flex items-center justify-center text-[10px] font-semibold text-white shrink-0`}
                        >
                          {getInitials(c.name)}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-medium truncate">{c.name}</p>
                          {c.email && (
                            <p className="text-muted-foreground truncate">
                              {c.email}
                            </p>
                          )}
                        </div>
                        {isCurrent && (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("create");
                      setCreateError(null);
                    }}
                    className={`w-full inline-flex items-center gap-2 px-2 py-2 text-xs font-medium rounded ${accent} hover:${accentBg} transition-colors`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Crear nueva aseguradora
                  </button>
                </div>
              </>
            ) : (
              <div className="p-3 grid gap-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">Nueva aseguradora</p>
                  <button
                    type="button"
                    onClick={() => setMode("list")}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Nombre *
                  </Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ej: La Caja Seguros"
                    className="h-8 text-xs"
                    autoFocus
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="siniestros@aseguradora.com"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Teléfono
                  </Label>
                  <Input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="0810-…"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Contacto
                  </Label>
                  <Input
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="Mesa de siniestros"
                    className="h-8 text-xs"
                  />
                </div>
                {createError && (
                  <p className="text-[11px] text-rose-600">{createError}</p>
                )}
                <button
                  type="button"
                  onClick={submitCreate}
                  disabled={creating}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md ${accent} ${accentBg} hover:brightness-95 px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60`}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Creando…
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" /> Crear y asignar
                    </>
                  )}
                </button>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Se agrega al catálogo de aseguradoras (visible en
                  /configuración).
                </p>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function VehicleSection({
  vehicle,
  onPatch,
}: {
  vehicle: VehicleDetail;
  onPatch: (patch: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <SectionCard
      icon={Car}
      title="Vehículo"
      iconTint="text-blue-600"
      iconBg="bg-blue-50"
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <BrandField
            label="Marca"
            value={vehicle.brand}
            onSave={(v) => onPatch({ brand: v })}
            compact
          />
          <ModelField
            label="Modelo"
            value={vehicle.model}
            brand={vehicle.brand}
            onSave={(v) => onPatch({ model: v })}
            compact
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <YearField
            label="Año"
            value={vehicle.year}
            onSave={(v) => onPatch({ year: v })}
            compact
          />
          <BlurField
            label="Patente"
            value={vehicle.domain}
            mono
            onSave={(v) => onPatch({ domain: v.toUpperCase() })}
          />
        </div>
        <div className="h-px bg-slate-100 my-1" />
        <div className="grid grid-cols-2 gap-2">
          <InsuranceField
            label="Seguro"
            value={vehicle.secure}
            onSave={(v) => onPatch({ secure: v })}
          />
          <InsuranceField
            label="Seguro del tercero"
            value={vehicle.thirdPartySecure}
            onSave={(v) => onPatch({ thirdPartySecure: v })}
          />
        </div>
      </div>
    </SectionCard>
  );
}

function CustomerSection({
  customer,
  onPatch,
}: {
  customer: CustomerDetail;
  onPatch: (patch: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <SectionCard
      icon={UserIcon}
      title="Cliente"
      iconTint="text-[#003b73]"
      iconBg="bg-[#003b73]/10"
    >
      <div className="grid gap-3">
        <BlurField
          label="Nombre"
          value={customer.name}
          onSave={(v) => onPatch({ name: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <BlurField
            label="Email"
            type="email"
            value={customer.email}
            icon={Mail}
            onSave={(v) => onPatch({ email: v })}
          />
          <BlurField
            label="Teléfono"
            value={customer.phone}
            icon={Phone}
            onSave={(v) => onPatch({ phone: v })}
          />
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <div className="grid gap-1">
            <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Doc.
            </Label>
            <Select
              value={customer.dniType ?? "DNI"}
              onValueChange={(v) => onPatch({ dniType: v })}
            >
              <SelectTrigger className="h-9">
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
          <BlurField
            label="Número"
            value={customer.dni ?? ""}
            icon={Hash}
            onSave={(v) => onPatch({ dni: v })}
          />
        </div>
      </div>
    </SectionCard>
  );
}

function NotesSection({
  value,
  onSave,
}: {
  value: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const lastSavedRef = useRef(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setDraft(value);
    lastSavedRef.current = value;
  }, [value]);

  // Debounce 700ms después del último keystroke
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (draft === lastSavedRef.current) return;
    timerRef.current = setTimeout(() => {
      lastSavedRef.current = draft;
      onSave(draft);
    }, 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [draft, onSave]);

  return (
    <SectionCard
      icon={FileText}
      title="Notas"
      iconTint="text-amber-600"
      iconBg="bg-amber-50"
    >
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        placeholder="Observaciones internas…"
        className="resize-none"
      />
    </SectionCard>
  );
}

function BudgetsSection({
  leadId,
  budgets,
  onOpenBudget,
  onSendBudget,
}: {
  leadId: string;
  budgets: BudgetLite[];
  onOpenBudget?: (leadId: string) => void;
  onSendBudget?: (budget: BudgetLite) => void;
}) {
  const STATUS_STYLES: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    sent: "bg-cyan-100 text-cyan-700",
    accepted: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
    expired: "bg-amber-100 text-amber-700",
  };

  const STATUS_LABEL: Record<string, string> = {
    draft: "Borrador",
    sent: "Enviado",
    accepted: "Aceptado",
    rejected: "Rechazado",
    expired: "Vencido",
  };

  return (
    <SectionCard
      icon={FileText}
      title="Presupuestos"
      iconTint="text-emerald-600"
      iconBg="bg-emerald-50"
    >
      {budgets.length === 0 ? (
        <button
          type="button"
          onClick={() => onOpenBudget?.(leadId)}
          className="w-full rounded-lg border-2 border-dashed border-slate-200 py-6 text-xs font-medium text-slate-500 hover:border-emerald-300 hover:bg-emerald-50/30 hover:text-emerald-700 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Cargar primer presupuesto
        </button>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => (
            <div
              key={b.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-emerald-300"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-slate-700">
                  #{b.number}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-medium ${
                    STATUS_STYLES[b.status] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {STATUS_LABEL[b.status] ?? b.status}
                </span>
              </div>
              <p className="font-semibold text-base text-slate-900 mt-1 tabular-nums">
                {ARS.format(Number(b.grandTotal))}
              </p>
              {b.sentAt ? (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 w-fit">
                  <Send className="h-2.5 w-2.5" />
                  Enviado {formatRelative(b.sentAt)}
                </div>
              ) : null}
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onOpenBudget?.(leadId)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => onSendBudget?.(b)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                >
                  <Send className="h-3 w-3" />
                  {b.status === "draft" ? "Enviar" : "Reenviar"}
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onOpenBudget?.(leadId)}
            className="w-full rounded-lg border-2 border-dashed border-slate-200 py-2.5 text-xs font-medium text-slate-500 hover:border-emerald-300 hover:bg-emerald-50/30 hover:text-emerald-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo presupuesto
          </button>
        </div>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────
// RepairSection — E3: integración CRM → Producción
// Aparece solo si existe una Repair linkeada al lead. Muestra el
// status actual + fechas clave + link al board de Producción.
// ─────────────────────────────────────────────────────────────

const REPAIR_STATUS_LABEL: Record<RepairStatusLite, string> = {
  turno_asignado: "Turno Asignado",
  ingresado: "Ingresado",
  repuestos_recibidos: "Repuestos Recibidos",
  chapa: "Chapa",
  pintura: "Pintura",
  calidad: "Calidad",
  experiencia_cliente: "Experiencia del Cliente",
  archivado: "Archivado",
};

const REPAIR_STATUS_COLOR: Record<RepairStatusLite, string> = {
  turno_asignado: "bg-slate-100 text-slate-700 border-slate-200",
  ingresado: "bg-blue-100 text-blue-700 border-blue-200",
  repuestos_recibidos: "bg-amber-100 text-amber-700 border-amber-200",
  chapa: "bg-orange-100 text-orange-700 border-orange-200",
  pintura: "bg-purple-100 text-purple-700 border-purple-200",
  calidad: "bg-cyan-100 text-cyan-700 border-cyan-200",
  experiencia_cliente: "bg-emerald-100 text-emerald-700 border-emerald-200",
  archivado: "bg-slate-200 text-slate-700 border-slate-300",
};

function RepairSection({ repairs }: { repairs: RepairLite[] }) {
  return (
    <SectionCard
      icon={Wrench}
      title="Reparación"
      iconTint="text-orange-600"
      iconBg="bg-orange-50"
    >
      <div className="space-y-2">
        {repairs.map((r) => (
          <RepairCard key={r.id} repair={r} />
        ))}
      </div>
    </SectionCard>
  );
}

function RepairCard({ repair }: { repair: RepairLite }) {
  const label = REPAIR_STATUS_LABEL[repair.status];
  const color = REPAIR_STATUS_COLOR[repair.status];
  const isArchived = repair.status === "archivado";

  const keyDate = (() => {
    if (repair.archivedAt)
      return { label: "Archivado", value: repair.archivedAt };
    if (repair.partsReceivedAt)
      return {
        label: "Repuestos recibidos",
        value: repair.partsReceivedAt,
      };
    if (repair.enteredAt)
      return { label: "Ingresado", value: repair.enteredAt };
    if (repair.scheduledAt)
      return { label: "Turno", value: repair.scheduledAt };
    return null;
  })();

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-medium ${color}`}
        >
          {label}
        </span>
        {repair.directCreation && (
          <span className="text-[9px] bg-indigo-50 border border-indigo-200 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
            Directa
          </span>
        )}
      </div>

      <div className="mt-2 grid gap-1 text-[11px]">
        {repair.assignedMechanic ? (
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full bg-[#003b73] text-white flex items-center justify-center text-[9px] font-semibold shrink-0">
              {getInitials(repair.assignedMechanic.name)}
            </div>
            <span className="text-slate-700">
              {repair.assignedMechanic.name ?? "Mecánico"}
            </span>
          </div>
        ) : (
          <div className="text-slate-400 italic flex items-center gap-1">
            <UserIcon className="h-3 w-3" />
            Sin mecánico asignado
          </div>
        )}

        {keyDate && (
          <div className="text-slate-500">
            {keyDate.label}: {formatDateShort(keyDate.value)}
          </div>
        )}

        {repair.estimatedDeliveryAt && !isArchived && (
          <div className="text-slate-500">
            Entrega estimada: {formatDateShort(repair.estimatedDeliveryAt)}
          </div>
        )}
      </div>

      <a
        href="/produccion"
        className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium text-orange-700 hover:text-orange-900 transition-colors"
      >
        <span>Ver en Producción</span>
        <ArrowRight className="h-3 w-3" />
      </a>
    </div>
  );
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function StatusSection({
  status,
  lostReason,
  lostNotes,
  onChangeStatus,
  onChangeLostReason,
  onChangeLostNotes,
}: {
  status: LeadStatus;
  lostReason: LeadLostReason | null;
  lostNotes: string | null;
  onChangeStatus: (s: LeadStatus) => Promise<void>;
  onChangeLostReason: (r: LeadLostReason) => Promise<void>;
  onChangeLostNotes: (n: string) => Promise<void>;
}) {
  return (
    <SectionCard
      icon={FileText}
      title="Estado"
      iconTint="text-purple-600"
      iconBg="bg-purple-50"
    >
      <div className="grid grid-cols-3 gap-1.5">
        {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((k) => {
          const active = status === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChangeStatus(k)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium border transition-colors ${
                active
                  ? "bg-[#003b73] text-white border-[#003b73]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  active ? "bg-white" : STATUS_DOT[k]
                }`}
              />
              {STATUS_LABELS[k]}
            </button>
          );
        })}
      </div>

      {status === "perdido" && (
        <div className="mt-4 grid gap-3 rounded-lg border border-rose-200 bg-rose-50/40 p-3">
          <div className="grid gap-1.5">
            <Label className="text-[10px] font-medium uppercase tracking-wider text-rose-700">
              Motivo de pérdida
            </Label>
            <Select
              value={lostReason ?? ""}
              onValueChange={(v) => onChangeLostReason(v as LeadLostReason)}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Seleccionar motivo…" />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <LostNotesField
            value={lostNotes ?? ""}
            onSave={(v) => onChangeLostNotes(v)}
          />
        </div>
      )}
    </SectionCard>
  );
}

function LostNotesField({
  value,
  onSave,
}: {
  value: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const lastSavedRef = useRef(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setDraft(value);
    lastSavedRef.current = value;
  }, [value]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (draft === lastSavedRef.current) return;
    timerRef.current = setTimeout(() => {
      lastSavedRef.current = draft;
      onSave(draft);
    }, 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [draft, onSave]);

  return (
    <div className="grid gap-1.5">
      <Label className="text-[10px] font-medium uppercase tracking-wider text-rose-700">
        Detalle
      </Label>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        placeholder="Contexto adicional…"
        className="resize-none bg-white"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers de input con auto-save al blur
// ─────────────────────────────────────────────────────────────

function BlurField({
  label,
  value,
  type,
  icon: Icon,
  mono,
  onSave,
}: {
  label: string;
  value: string;
  type?: string;
  icon?: React.ComponentType<{ className?: string }>;
  mono?: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const originalRef = useRef(value);

  useEffect(() => {
    setDraft(value);
    originalRef.current = value;
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === originalRef.current) return;
    originalRef.current = trimmed;
    onSave(trimmed);
  };

  return (
    <div className="grid gap-1">
      <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </Label>
      <Input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={mono ? "font-mono uppercase tracking-wider" : ""}
      />
    </div>
  );
}

function InsuranceField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Insurance[] | null>(null);
  const originalRef = useRef(value);

  useEffect(() => {
    setDraft(value);
    originalRef.current = value;
    setDirty(false);
  }, [value]);

  useEffect(() => {
    if (!open || options !== null) return;
    fetch("/api/insurance-companies?active=1")
      .then((r) => r.json())
      .then((b) => setOptions((b.companies ?? []) as Insurance[]))
      .catch(() => setOptions([]));
  }, [open, options]);

  const commit = (newValue?: string) => {
    const final = (newValue ?? draft).trim();
    if (final === originalRef.current) {
      setDirty(false);
      return;
    }
    originalRef.current = final;
    setDirty(false);
    onSave(final);
  };

  const filtered = dirty
    ? (options ?? []).filter((o) =>
        o.name.toLowerCase().includes(draft.toLowerCase()),
      )
    : (options ?? []);

  return (
    <div className="grid gap-1">
      <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500 flex items-center gap-1">
        <Shield className="h-3 w-3" /> {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Input
            value={draft}
            onChange={(e) => {
              setDirty(true);
              setDraft(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={(e) => {
              setOpen(true);
              e.currentTarget.select();
            }}
            onBlur={() => {
              // Pequeño delay para que el click del popover tenga tiempo
              setTimeout(() => {
                setOpen(false);
                commit();
              }, 150);
            }}
            placeholder="Escribí o elegí aseguradora…"
            className="text-left"
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
        >
          {options === null ? (
            <div className="py-3 text-center text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 inline animate-spin" /> Cargando…
            </div>
          ) : options.length === 0 ? (
            <div className="py-3 px-2 text-center text-xs text-muted-foreground">
              <p className="italic mb-1">Todavía no hay aseguradoras.</p>
              <a
                href="/configuracion"
                className="text-[11px] font-medium text-[#003b73] hover:underline"
              >
                Cargar en Configuración →
              </a>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground italic">
              Sin coincidencias — el texto libre igual se guarda.
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseDown={(e) => {
                    // mousedown para que corra antes del onBlur del input
                    e.preventDefault();
                    setDraft(o.name);
                    commit(o.name);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 text-left text-xs px-2 py-1.5 hover:bg-accent rounded"
                >
                  <Shield className="h-3 w-3 text-slate-400 shrink-0" />
                  {o.name}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function SavingIndicator({ state }: { state: "idle" | "saving" | "saved" }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Guardando…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-emerald-100">
        <Check className="h-2.5 w-2.5" /> Guardado
      </span>
    );
  }
  return null;
}
