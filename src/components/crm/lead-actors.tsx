"use client";

import {
  Briefcase,
  Check,
  Loader2,
  Search,
  Shield,
  User as UserIcon,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Actor, ActorKind } from "./leads-kanban";

type UserOption = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

type Props = {
  leadId: string;
  customer: { id: string; name: string; email: string };
  inspector: Actor | null;
  insuranceAgent: Actor | null;
  onAssign: (
    leadId: string,
    kind: ActorKind,
    userId: string | null,
  ) => Promise<void>;
};

/**
 * Muestra los 3 actores de una cotización como avatares apilados con popover.
 *   [Cliente]  — lectura, viene del customer (no se asigna acá)
 *   [Inspector]  — click → popover con users rol=inspector
 *   [Productor]  — click → popover con users rol=productor_seguros
 */
export function LeadActors({
  leadId,
  customer,
  inspector,
  insuranceAgent,
  onAssign,
}: Props) {
  return (
    <div className="flex items-center -space-x-1.5">
      <ActorAvatar
        title="Cliente"
        name={customer.name}
        kind="client"
        ring="ring-[#003b73]"
      />
      <ActorPopover
        title="Inspector / Perito"
        kind="inspector"
        roleKey="inspector"
        current={inspector}
        onAssign={(userId) => onAssign(leadId, "inspector", userId)}
      />
      <ActorPopover
        title="Productor de Seguros"
        kind="insurance"
        roleKey="productor_seguros"
        current={insuranceAgent}
        onAssign={(userId) => onAssign(leadId, "insurance", userId)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Avatar base (solo display, no click)
// ─────────────────────────────────────────────────────────────

function initials(name: string | null | undefined): string {
  const s = (name ?? "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const KIND_STYLES: Record<
  "client" | "inspector" | "insurance",
  { bg: string; fg: string; icon: typeof UserIcon }
> = {
  client: { bg: "bg-[#003b73]", fg: "text-white", icon: UserIcon },
  inspector: { bg: "bg-cyan-600", fg: "text-white", icon: Shield },
  insurance: { bg: "bg-emerald-600", fg: "text-white", icon: Briefcase },
};

function ActorAvatar({
  name,
  kind,
  title,
  ring,
}: {
  name: string | null;
  kind: "client" | "inspector" | "insurance";
  title: string;
  ring?: string;
}) {
  const style = KIND_STYLES[kind];
  return (
    <div
      title={`${title}${name ? `: ${name}` : ""}`}
      className={`h-6 w-6 rounded-full ring-2 ring-white ${ring ?? ""} flex items-center justify-center text-[10px] font-semibold ${style.bg} ${style.fg}`}
    >
      {initials(name)}
    </div>
  );
}

function EmptyActorSlot({
  kind,
  title,
}: {
  kind: "inspector" | "insurance";
  title: string;
}) {
  const Icon = KIND_STYLES[kind].icon;
  return (
    <div
      title={`Asignar ${title}`}
      className="h-6 w-6 rounded-full ring-2 ring-white bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
    >
      <Icon className="h-3 w-3" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Popover: lista de usuarios por rol, con búsqueda
// ─────────────────────────────────────────────────────────────

function ActorPopover({
  title,
  kind,
  roleKey,
  current,
  onAssign,
}: {
  title: string;
  kind: "inspector" | "insurance";
  roleKey: "inspector" | "productor_seguros";
  current: Actor | null;
  onAssign: (userId: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users?role=${roleKey}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { users: UserOption[] };
      setUsers(data.users.filter((u) => u.email));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, [roleKey]);

  useEffect(() => {
    if (open && users === null) fetchUsers();
  }, [open, users, fetchUsers]);

  const handlePick = async (userId: string | null) => {
    setAssigningId(userId ?? "__none");
    try {
      await onAssign(userId);
      setOpen(false);
    } finally {
      setAssigningId(null);
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer">
          {current ? (
            <ActorAvatar name={current.name} kind={kind} title={title} />
          ) : (
            <EmptyActorSlot kind={kind} title={title} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0" side="bottom">
        <div className="px-3 py-2 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-700">{title}</p>
          {current && (
            <p className="text-[10px] text-slate-500 truncate">
              Asignado: {current.name}
            </p>
          )}
        </div>

        <div className="relative border-b border-slate-100">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 border-0 focus-visible:ring-0 rounded-none"
          />
        </div>

        <div className="max-h-64 overflow-y-auto py-1">
          {/* Opción: sin asignar */}
          {current && (
            <button
              type="button"
              onClick={() => handlePick(null)}
              disabled={assigningId !== null}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Quitar asignación
              {assigningId === "__none" && (
                <Loader2 className="h-3 w-3 animate-spin ml-auto" />
              )}
            </button>
          )}

          {loading && (
            <div className="flex items-center justify-center py-6 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Cargando…
            </div>
          )}

          {error && (
            <p className="px-3 py-4 text-xs text-rose-600">{error}</p>
          )}

          {!loading && !error && filtered.length === 0 && (
            <p className="px-3 py-6 text-xs text-slate-400 text-center italic">
              {search
                ? "Sin resultados"
                : `No hay usuarios con rol "${roleKey}" cargados aún.`}
            </p>
          )}

          {!loading &&
            filtered.map((u) => {
              const isCurrent = current?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handlePick(u.id)}
                  disabled={assigningId !== null || isCurrent}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors disabled:cursor-default ${
                    isCurrent
                      ? "bg-slate-50 cursor-default"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <ActorAvatar
                    name={u.name}
                    kind={kind}
                    title={title}
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-slate-900 truncate">
                      {u.name ?? "—"}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {u.email}
                    </p>
                  </div>
                  {isCurrent && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                  {assigningId === u.id && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                </button>
              );
            })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
