"use client";

/**
 * Selectores de actores del lead — perito/inspector, productor de seguros y
 * compañía aseguradora.
 *
 * Viven acá y no dentro de la ficha del lead porque se usan en dos momentos:
 * al tomar el presupuesto (alta de solicitud, donde el lead todavía no
 * existe y los ids quedan en el form) y después en la ficha (donde cada
 * cambio se guarda al instante). Los tres permiten crear el actor sin salir
 * del selector.
 */

import { Check, Loader2, Plus, Shield, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  INSURANCE_COMPANIES_KEY,
  invalidateCache,
  loadInsuranceCompanies,
} from "@/lib/client-cache";

export type UserLite = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export type InsuranceCompanyLite = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  contactName: string | null;
};

/** Iniciales para el avatar del actor (máx. 2 palabras). */
export function getInitials(name: string | null | undefined): string {
  const s = (name ?? "").trim();
  if (!s) return "?";
  return (
    s
      .split(/s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function ActorRow({
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
  /** Devuelve el actor completo (o null al desasignar). */
  onPick: (user: UserLite | null) => void;
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
      onPick(created);
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
                          onPick(u);
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

export function InsuranceCompanyRow({
  current,
  onPick,
}: {
  current: InsuranceCompanyLite | null;
  /** Devuelve la compañía completa (o null al desasignar). */
  onPick: (company: InsuranceCompanyLite | null) => void;
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
    // Perf audit: cache module-level — varios componentes piden esta misma
    // lista (lead-canvas, repair-canvas, vehicle-form).
    loadInsuranceCompanies()
      .then((list) => setCompanies(list as InsuranceCompanyLite[]))
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
      // Perf audit: la lista cacheada quedó vieja — invalidamos para que el
      // próximo consumidor traiga la nueva aseguradora.
      invalidateCache(INSURANCE_COMPANIES_KEY);
      onPick(created);
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
                          onPick(c);
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
