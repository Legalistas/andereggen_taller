"use client";

import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Car,
  Check,
  ChevronDown,
  FileText,
  Hash,
  Loader2,
  Mail,
  Phone,
  Printer,
  Smile,
  Star,
  User as UserIcon,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { FichasDialog } from "../crm/fichas-dialog";
import type { RepairStatus } from "./production-kanban";

type UserLite = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

type RepairDetail = {
  id: string;
  status: RepairStatus;
  /** Nº interno del taller — correlativo único, sale en la Ficha Técnica.
   *  Nullable porque las repairs anteriores a este campo no lo tienen. */
  internalNumber: number | null;
  customerId: string | null;
  vehicleId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleDomain: string;
  reason: string | null;
  directCreation: boolean;
  scheduledAt: string | null;
  enteredAt: string | null;
  partsReceivedAt: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  archivedAt: string | null;
  notes: string | null;
  assignedMechanic: UserLite | null;
  budget: {
    id: string;
    number: number;
    status: string;
    grandTotal: string | number;
  } | null;
  lead: { id: string; status: string } | null;
  serviceRating?: {
    stars: number | null;
    respondedAt: string | null;
    token: string;
  } | null;
};

const STATUS_LABEL: Record<RepairStatus, string> = {
  turno_asignado: "Turno Asignado",
  ingresado: "Ingresado",
  pendientes_repuestos: "Pendientes de Repuestos",
  chapa: "Chapa",
  pintura: "Pintura",
  calidad: "Calidad",
  pendientes_cobro: "Pendientes de Cobro",
  experiencia_cliente: "Experiencia del Cliente",
  archivado: "Archivado",
};

const STATUS_DOT: Record<RepairStatus, string> = {
  turno_asignado: "bg-slate-500",
  ingresado: "bg-blue-500",
  pendientes_repuestos: "bg-amber-500",
  chapa: "bg-orange-500",
  pintura: "bg-purple-500",
  calidad: "bg-cyan-500",
  pendientes_cobro: "bg-amber-600",
  experiencia_cliente: "bg-emerald-500",
  archivado: "bg-slate-400",
};

const ALL_STATUSES: RepairStatus[] = [
  "turno_asignado",
  "pendientes_repuestos",
  "chapa",
  "pintura",
  "calidad",
  "pendientes_cobro",
  "experiencia_cliente",
  "archivado",
];

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

type Props = {
  repairId: string | null;
  onClose: () => void;
  /** Llamada cuando la reparación cambia, para refrescar el board. */
  onChanged?: () => void;
  /**
   * Forzar refetch (ej: después de un cambio externo).
   */
  reloadNonce?: number;
};

export function RepairCanvas({
  repairId,
  onClose,
  onChanged,
  reloadNonce,
}: Props) {
  const [repair, setRepair] = useState<RepairDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingIndicator, setSavingIndicator] = useState<
    "idle" | "saving" | "saved"
  >("idle");

  const markSaving = useCallback(() => setSavingIndicator("saving"), []);
  const markSaved = useCallback(() => {
    setSavingIndicator("saved");
    setTimeout(() => setSavingIndicator("idle"), 1500);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadNonce trigger deliberado
  useEffect(() => {
    if (!repairId) {
      setRepair(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/repairs/${repairId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((body) => {
        if (!cancelled) setRepair(body.repair as RepairDetail);
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
  }, [repairId, reloadNonce]);

  const patchRepair = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!repairId) return;
      markSaving();
      try {
        const res = await fetch(`/api/repairs/${repairId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const body = await res.json();
        setRepair((prev) =>
          prev ? { ...prev, ...(body.repair as Partial<RepairDetail>) } : prev,
        );
        markSaved();
        onChanged?.();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Error al guardar");
        setSavingIndicator("idle");
      }
    },
    [repairId, markSaving, markSaved, onChanged],
  );

  const changeStatus = useCallback(
    async (next: RepairStatus) => {
      if (!repairId || !repair || repair.status === next) return;
      markSaving();
      try {
        const res = await fetch(`/api/repairs/${repairId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const body = await res.json();
        setRepair((prev) =>
          prev ? { ...prev, ...(body.repair as Partial<RepairDetail>) } : prev,
        );
        markSaved();
        onChanged?.();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Error al cambiar estado");
        setSavingIndicator("idle");
      }
    },
    [repairId, repair, markSaving, markSaved, onChanged],
  );

  return (
    <Sheet
      open={repairId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="p-0 bg-slate-50/60"
        showCloseButton={false}
      >
        {!repair && (
          <SheetTitle className="sr-only">Detalle de la reparación</SheetTitle>
        )}

        {loading && !repair && (
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

        {repair && (
          <>
            <SheetHeader className="relative bg-linear-to-br from-orange-700 to-orange-900 text-white p-5 pr-14 border-b-0 gap-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="absolute top-3 right-3 h-8 w-8 rounded-md hover:bg-white/15 flex items-center justify-center transition-colors"
              >
                <XIcon className="h-4 w-4" />
              </button>

              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-white/15 ring-2 ring-white/30 flex items-center justify-center shrink-0">
                  <Wrench className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-white text-lg truncate flex items-center gap-2">
                    {repair.customerName}
                    {repair.internalNumber !== null && (
                      <span className="font-mono bg-white text-[#003b73] px-2 py-0.5 rounded text-[11px] font-bold tracking-wider">
                        INT #{repair.internalNumber}
                      </span>
                    )}
                  </SheetTitle>
                  <SheetDescription className="text-white/80 flex items-center gap-1.5 mt-1 text-xs">
                    <Car className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {repair.vehicleBrand} {repair.vehicleModel}{" "}
                      {repair.vehicleYear}
                    </span>
                    <span className="font-mono bg-white/15 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
                      {repair.vehicleDomain}
                    </span>
                  </SheetDescription>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <StatusPicker status={repair.status} onChange={changeStatus} />
                {repair.directCreation && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-400/30 px-2 py-0.5 text-[10px] font-medium">
                    Directa
                  </span>
                )}
                <SavingIndicator state={savingIndicator} />
              </div>
            </SheetHeader>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              <InternalNumberSection
                value={repair.internalNumber}
                onSave={(n) => patchRepair({ internalNumber: n })}
              />

              <MechanicSection
                current={repair.assignedMechanic}
                onPick={(userId) => patchRepair({ assignedMechanicId: userId })}
              />

              <DatesSection repair={repair} onPatch={patchRepair} />

              {repair.budget && (
                <BudgetSection
                  budget={repair.budget}
                  leadId={repair.lead?.id}
                />
              )}

              <CustomerVehicleSection repair={repair} />

              <NotesSection
                value={repair.notes ?? ""}
                onSave={(notes) => patchRepair({ notes: notes || null })}
              />

              {repair.serviceRating && (
                <RatingSection rating={repair.serviceRating} />
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
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

/**
 * Selector de status que vive en el header del canvas. Muestra el status
 * actual como una pill clickeable; al click abre un Popover con todos los
 * estados disponibles para cambiar.
 */
function StatusPicker({
  status,
  onChange,
}: {
  status: RepairStatus;
  onChange: (s: RepairStatus) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-2.5 py-1 text-[11px] font-medium hover:bg-white/25 transition-colors"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
          {STATUS_LABEL[status]}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="flex flex-col">
          {ALL_STATUSES.map((s) => {
            const active = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={async () => {
                  setOpen(false);
                  if (s !== status) await onChange(s);
                }}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-left transition-colors ${
                  active
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[s]}`}
                />
                <span className="flex-1">{STATUS_LABEL[s]}</span>
                {active && <Check className="h-3.5 w-3.5 text-[#003b73]" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function InternalNumberSection({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (n: number | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si el valor del server cambia (otro usuario lo editó, etc.) sincronizamos.
  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  const commit = async () => {
    setError(null);
    const trimmed = draft.trim();
    if (trimmed === "" && value === null) return; // nada que cambiar
    if (trimmed === String(value ?? "")) return;
    let parsed: number | null = null;
    if (trimmed !== "") {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n <= 0) {
        setError("Debe ser un entero positivo");
        return;
      }
      parsed = n;
    }
    setSaving(true);
    try {
      await onSave(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      icon={Hash}
      title="Nº interno"
      iconTint="text-[#003b73]"
      iconBg="bg-[#003b73]/10"
    >
      <div className="space-y-1.5">
        <Input
          type="number"
          min="1"
          step="1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Sin asignar"
          disabled={saving}
          className="font-mono text-base font-semibold"
        />
        <p className="text-[10px] text-muted-foreground">
          Correlativo del taller. Aparece en la Ficha Técnica.
          {error && (
            <span className="block text-destructive font-medium mt-0.5">
              {error}
            </span>
          )}
        </p>
      </div>
    </SectionCard>
  );
}

function MechanicSection({
  current,
  onPick,
}: {
  current: UserLite | null;
  onPick: (userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserLite[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || users !== null) return;
    fetch("/api/users?role=mecanico")
      .then((r) => r.json())
      .then((b) => setUsers((b.users ?? []) as UserLite[]))
      .catch(() => setUsers([]));
  }, [open, users]);

  const filtered = (users ?? []).filter((u) => {
    if (!search) return true;
    const t = search.toLowerCase();
    return (
      (u.name ?? "").toLowerCase().includes(t) ||
      (u.email ?? "").toLowerCase().includes(t)
    );
  });

  return (
    <SectionCard
      icon={UserIcon}
      title="Mecánico asignado"
      iconTint="text-cyan-600"
      iconBg="bg-cyan-50"
    >
      <div className="flex items-center justify-between gap-2">
        {current ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-full bg-[#003b73] text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
              {getInitials(current.name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {current.name ?? "—"}
              </p>
              {current.email && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {current.email}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Sin asignar</p>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {current && (
            <button
              type="button"
              onClick={() => onPick(null)}
              className="text-[11px] text-slate-500 hover:text-rose-600 transition-colors px-2 py-1"
            >
              Quitar
            </button>
          )}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-cyan-700 bg-cyan-50 hover:bg-cyan-100 transition-colors"
              >
                {current ? "Cambiar" : "Asignar"}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 p-0"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="p-2 border-b">
                <Input
                  placeholder="Buscar mecánico…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {users === null && (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin mr-2" /> Cargando…
                  </div>
                )}
                {users !== null && filtered.length === 0 && (
                  <p className="px-2 py-6 text-xs text-center text-muted-foreground italic">
                    {search
                      ? "Sin resultados"
                      : "No hay usuarios con rol mecánico cargados."}
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
                      <div className="h-6 w-6 rounded-full bg-[#003b73] text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                        {getInitials(u.name)}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-medium truncate">{u.name ?? "—"}</p>
                        {u.email && (
                          <p className="text-muted-foreground truncate">
                            {u.email}
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
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </SectionCard>
  );
}

function DatesSection({
  repair,
  onPatch,
}: {
  repair: RepairDetail;
  onPatch: (patch: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <SectionCard
      icon={Calendar}
      title="Fechas clave"
      iconTint="text-blue-600"
      iconBg="bg-blue-50"
    >
      <div className="grid grid-cols-2 gap-3">
        <DateField
          label="Turno asignado"
          value={repair.scheduledAt}
          onSave={(v) => onPatch({ scheduledAt: v })}
        />
        <DateField
          label="Ingresado"
          value={repair.enteredAt}
          onSave={(v) => onPatch({ enteredAt: v })}
        />
        <DateField
          label="Repuestos recibidos"
          value={repair.partsReceivedAt}
          onSave={(v) => onPatch({ partsReceivedAt: v })}
          readonly
        />
        <DateField
          label="Entrega estimada"
          value={repair.estimatedDeliveryAt}
          onSave={(v) => onPatch({ estimatedDeliveryAt: v })}
        />
        <DateField
          label="Entregado"
          value={repair.deliveredAt}
          onSave={(v) => onPatch({ deliveredAt: v })}
        />
        <DateField
          label="Archivado"
          value={repair.archivedAt}
          onSave={(v) => onPatch({ archivedAt: v })}
          readonly
        />
      </div>
    </SectionCard>
  );
}

function DateField({
  label,
  value,
  onSave,
  readonly,
}: {
  label: string;
  value: string | null;
  onSave: (value: string | null) => void;
  readonly?: boolean;
}) {
  // input type="date" usa formato YYYY-MM-DD
  const dateValue = value ? new Date(value).toISOString().slice(0, 10) : "";

  return (
    <div className="grid gap-1">
      <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </Label>
      <Input
        type="date"
        value={dateValue}
        readOnly={readonly}
        disabled={readonly}
        onChange={(e) => {
          const v = e.target.value;
          onSave(v ? new Date(v).toISOString() : null);
        }}
        className={readonly ? "opacity-60 cursor-not-allowed" : ""}
      />
    </div>
  );
}

function CustomerVehicleSection({ repair }: { repair: RepairDetail }) {
  return (
    <SectionCard
      icon={UserIcon}
      title="Cliente y vehículo (snapshot)"
      iconTint="text-[#003b73]"
      iconBg="bg-[#003b73]/10"
    >
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Cliente
          </Label>
          <p className="text-sm font-medium">{repair.customerName}</p>
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {repair.customerEmail && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {repair.customerEmail}
              </span>
            )}
            {repair.customerPhone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {repair.customerPhone}
              </span>
            )}
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="grid gap-1.5">
          <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Vehículo
          </Label>
          <p className="text-sm font-medium">
            {repair.vehicleBrand} {repair.vehicleModel} {repair.vehicleYear}
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Hash className="h-3 w-3" />
            <span className="font-mono uppercase">{repair.vehicleDomain}</span>
          </div>
        </div>

        {repair.reason && (
          <>
            <div className="h-px bg-slate-100" />
            <div className="grid gap-1.5">
              <Label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Motivo de ingreso
              </Label>
              <p className="text-sm whitespace-pre-wrap">{repair.reason}</p>
            </div>
          </>
        )}

        <p className="text-[10px] text-muted-foreground italic">
          Datos copiados al crear la reparación. No se modifican aunque se edite
          el cliente o vehículo después.
        </p>
      </div>
    </SectionCard>
  );
}

function BudgetSection({
  budget,
  leadId,
}: {
  budget: NonNullable<RepairDetail["budget"]>;
  leadId: string | undefined;
}) {
  // Dialog "Fichas" — Ficha Técnica + Ficha Ingreso/Egreso. Se abre desde acá
  // (Producción) porque el flujo es: turno asignado → imprimir fichas para
  // pegar en el auto y hacer firmar al cliente.
  const [fichasOpen, setFichasOpen] = useState(false);

  return (
    <>
      <SectionCard
        icon={FileText}
        title="Presupuesto vinculado"
        iconTint="text-emerald-600"
        iconBg="bg-emerald-50"
      >
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-semibold text-slate-700">
              #{budget.number}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-medium bg-emerald-100 text-emerald-700">
              {budget.status}
            </span>
          </div>
          <p className="font-semibold text-base text-slate-900 mt-1 tabular-nums">
            {ARS.format(Number(budget.grandTotal))}
          </p>
          <button
            type="button"
            onClick={() => setFichasOpen(true)}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
            title="Imprimir Ficha Técnica y Ficha de Ingreso/Egreso"
          >
            <Printer className="h-3 w-3" />
            Imprimir fichas
          </button>
          {leadId && (
            <a
              href={`/crm/leads`}
              className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium text-emerald-700 hover:text-emerald-900 transition-colors"
            >
              <span>Ver en CRM</span>
              <ArrowRight className="h-3 w-3" />
            </a>
          )}
        </div>
      </SectionCard>
      <FichasDialog
        budgetId={fichasOpen ? budget.id : null}
        open={fichasOpen}
        onOpenChange={setFichasOpen}
      />
    </>
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
      title="Notas internas"
      iconTint="text-amber-600"
      iconBg="bg-amber-50"
    >
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        placeholder="Observaciones, fotos pendientes, comentarios del taller…"
        className="resize-none"
      />
    </SectionCard>
  );
}

function RatingSection({
  rating,
}: {
  rating: NonNullable<RepairDetail["serviceRating"]>;
}) {
  const responded = rating.respondedAt && rating.stars !== null;

  return (
    <SectionCard
      icon={Smile}
      title="Encuesta de satisfacción"
      iconTint="text-emerald-600"
      iconBg="bg-emerald-50"
    >
      {responded ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`h-5 w-5 ${
                    rating.stars !== null && n <= rating.stars
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-200"
                  }`}
                />
              ))}
            </div>
            <span className="font-bold tabular-nums">{rating.stars}/5</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Respondida el{" "}
            {rating.respondedAt
              ? new Date(rating.respondedAt).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
              : ""}
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground italic">
            Esperando respuesta del cliente.
          </p>
          <a
            href={`/reviews/${rating.token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-emerald-700 hover:text-emerald-900"
          >
            Ver link →
          </a>
        </div>
      )}
    </SectionCard>
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
