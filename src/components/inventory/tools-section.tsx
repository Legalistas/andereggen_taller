"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Edit,
  Hammer,
  Loader2,
  MapPin,
  MoreVertical,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  User as UserIcon,
  UserMinus,
  UserPlus,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";
import {
  TOOL_CATEGORIES,
  TOOL_CATEGORY_BY_KEY,
  TOOL_STATUS_CONFIG,
} from "@/lib/tools-catalog";
import type {
  ToolCategory,
  ToolStatus,
} from "../../../generated/prisma/client";

type Tool = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  category: ToolCategory;
  status: ToolStatus;
  location: string | null;
  cost: string | number;
  acquiredAt: string | null;
  notes: string | null;
  isActive: boolean;
  assignedTo: { id: string; name: string | null; email: string | null } | null;
  createdAt: string;
};

type UserLite = { id: string; name: string | null; email: string | null };

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function ToolsSection() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<ToolCategory | "all">(
    "all",
  );
  const [filterStatus, setFilterStatus] = useState<ToolStatus | "all">("all");

  // Dialog CRUD
  const [formOpen, setFormOpen] = useState(false);
  const [formTool, setFormTool] = useState<Tool | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    brand: "",
    category: "OTROS" as ToolCategory,
    status: "AVAILABLE" as ToolStatus,
    location: "",
    cost: "",
    acquiredAt: "",
    description: "",
    notes: "",
    isActive: true,
  });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Dialog asignar/devolver
  const [assignTool, setAssignTool] = useState<Tool | null>(null);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Delete
  const [deleteTool, setDeleteTool] = useState<Tool | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────
  const fetchTools = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (filterCategory !== "all") params.set("category", filterCategory);
        if (filterStatus !== "all") params.set("status", filterStatus);
        const res = await fetch(`/api/tools?${params}`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { tools: Tool[] };
        setTools(data.tools);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setLoadError(
            e instanceof Error ? e.message : "Error al cargar herramientas",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [search, filterCategory, filterStatus],
  );

  useEffect(() => {
    const ac = new AbortController();
    const t = setTimeout(() => fetchTools(ac.signal), 200);
    return () => {
      ac.abort();
      clearTimeout(t);
    };
  }, [fetchTools]);

  // Fetch users una vez para el select de asignación
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.users)) setUsers(data.users as UserLite[]);
      })
      .catch(() => {});
  }, []);

  // ── Stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const byStatus: Record<ToolStatus, number> = {
      AVAILABLE: 0,
      IN_USE: 0,
      MAINTENANCE: 0,
      RETIRED: 0,
    };
    let totalCost = 0;
    for (const t of tools) {
      byStatus[t.status]++;
      totalCost += Number(t.cost);
    }
    return { total: tools.length, byStatus, totalCost };
  }, [tools]);

  // ── Handlers ─────────────────────────────────────────────────
  const openCreate = () => {
    setFormTool(null);
    setForm({
      code: "",
      name: "",
      brand: "",
      category: "OTROS",
      status: "AVAILABLE",
      location: "",
      cost: "",
      acquiredAt: "",
      description: "",
      notes: "",
      isActive: true,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (t: Tool) => {
    setFormTool(t);
    setForm({
      code: t.code ?? "",
      name: t.name,
      brand: t.brand ?? "",
      category: t.category,
      status: t.status,
      location: t.location ?? "",
      cost: String(t.cost),
      acquiredAt: t.acquiredAt ? t.acquiredAt.slice(0, 10) : "",
      description: t.description ?? "",
      notes: t.notes ?? "",
      isActive: t.isActive,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (!form.name.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      const payload = {
        code: form.code || null,
        name: form.name.trim(),
        brand: form.brand || null,
        category: form.category,
        status: form.status,
        location: form.location || null,
        cost: Number(form.cost || 0),
        acquiredAt: form.acquiredAt || null,
        description: form.description || null,
        notes: form.notes || null,
        isActive: form.isActive,
      };
      const res = formTool
        ? await fetch(`/api/tools/${formTool.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/tools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setFormOpen(false);
      await fetchTools();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setFormBusy(false);
    }
  };

  const openAssign = (t: Tool) => {
    setAssignTool(t);
    setAssignUserId(t.assignedTo?.id ?? "");
    setAssignError(null);
  };

  const submitAssign = async () => {
    if (!assignTool) return;
    if (!assignUserId) {
      setAssignError("Seleccioná un usuario");
      return;
    }
    setAssignBusy(true);
    setAssignError(null);
    try {
      const res = await fetch(`/api/tools/${assignTool.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: assignUserId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setAssignTool(null);
      await fetchTools();
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : "Error");
    } finally {
      setAssignBusy(false);
    }
  };

  const submitReturn = async (t: Tool) => {
    await fetch(`/api/tools/${t.id}/assign`, { method: "DELETE" });
    await fetchTools();
  };

  const submitStatus = async (t: Tool, status: ToolStatus) => {
    await fetch(`/api/tools/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchTools();
  };

  const submitDelete = async () => {
    if (!deleteTool) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/tools/${deleteTool.id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setDeleteTool(null);
      await fetchTools();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Error");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Breadcrumbs
            items={[{ label: "Inventario" }, { label: "Herramientas" }]}
          />
          <h1 className="text-3xl font-bold">Herramientas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Activos físicos del taller. Asigná herramientas a mecánicos y
            controlá su estado.
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nueva herramienta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Total"
          value={String(stats.total)}
          icon={Hammer}
          color="blue"
        />
        <StatCard
          label="Disponibles"
          value={String(stats.byStatus.AVAILABLE)}
          icon={CheckCircle2}
          color="green"
        />
        <StatCard
          label="En uso"
          value={String(stats.byStatus.IN_USE)}
          icon={UserIcon}
          color="indigo"
        />
        <StatCard
          label="Mantenimiento"
          value={String(stats.byStatus.MAINTENANCE)}
          icon={Wrench}
          color="orange"
        />
        <StatCard
          label="Valor total"
          value={ARS.format(stats.totalCost)}
          icon={Settings}
          color="purple"
        />
      </div>

      {/* Filtros */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Input
            placeholder="Buscar por nombre, código, marca o ubicación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:max-w-md"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchTools()}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Categoría</Label>
            <Select
              value={filterCategory}
              onValueChange={(v) =>
                setFilterCategory(v as ToolCategory | "all")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {TOOL_CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as ToolStatus | "all")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="AVAILABLE">Disponible</SelectItem>
                <SelectItem value="IN_USE">En uso</SelectItem>
                <SelectItem value="MAINTENANCE">Mantenimiento</SelectItem>
                <SelectItem value="RETIRED">Dada de baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        {loadError && (
          <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {loadError}
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Herramienta</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Asignada a</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && tools.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  <Loader2 className="h-5 w-5 inline animate-spin mr-2" />{" "}
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!loading && tools.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-10 text-sm text-muted-foreground"
                >
                  Sin herramientas para mostrar.
                </TableCell>
              </TableRow>
            )}
            {tools.map((t) => {
              const catStyle = TOOL_CATEGORY_BY_KEY[t.category];
              const statStyle = TOOL_STATUS_CONFIG[t.status];
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Hammer className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.code && (
                            <span className="font-mono">{t.code}</span>
                          )}
                          {t.code && t.brand && <span> · </span>}
                          {t.brand && <span>{t.brand}</span>}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={catStyle.color}>
                      {catStyle.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`gap-1 ${statStyle.color}`}
                    >
                      <div
                        className={`h-2 w-2 rounded-full ${statStyle.dot}`}
                      />
                      {statStyle.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {t.assignedTo ? (
                      <div className="flex items-center gap-1 text-sm">
                        <UserIcon className="h-3 w-3 text-muted-foreground" />
                        {t.assignedTo.name ?? t.assignedTo.email}
                      </div>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.location ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {t.location}
                      </div>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {ARS.format(Number(t.cost))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {t.status === "AVAILABLE" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => openAssign(t)}
                        >
                          <UserPlus className="h-4 w-4" /> Asignar
                        </Button>
                      )}
                      {t.status === "IN_USE" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => submitReturn(t)}
                        >
                          <UserMinus className="h-4 w-4" /> Devolver
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() => openEdit(t)}
                          >
                            <Edit className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          {t.status !== "MAINTENANCE" && (
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => submitStatus(t, "MAINTENANCE")}
                            >
                              <Wrench className="h-4 w-4 text-orange-600" />{" "}
                              Marcar en mantenimiento
                            </DropdownMenuItem>
                          )}
                          {t.status !== "AVAILABLE" &&
                            t.status !== "RETIRED" && (
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => submitStatus(t, "AVAILABLE")}
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-600" />{" "}
                                Marcar disponible
                              </DropdownMenuItem>
                            )}
                          {t.status !== "RETIRED" && (
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => submitStatus(t, "RETIRED")}
                            >
                              <AlertTriangle className="h-4 w-4 text-gray-600" />{" "}
                              Dar de baja
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="gap-2 text-destructive"
                            onClick={() => {
                              setDeleteTool(t);
                              setDeleteError(null);
                            }}
                          >
                            <Trash2 className="h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog: Nueva/Editar */}
      <Dialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setFormError(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {formTool ? (
                <Edit className="h-5 w-5 text-[#003b73]" />
              ) : (
                <Plus className="h-5 w-5 text-[#003b73]" />
              )}
              {formTool ? "Editar herramienta" : "Nueva herramienta"}
            </DialogTitle>
            <DialogDescription>
              {formTool
                ? "Actualizá datos de la herramienta."
                : "Creá un registro de herramienta (un ítem físico)."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="toolCode">Código / patrimonial</Label>
                <Input
                  id="toolCode"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  placeholder="SOL-001"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="toolBrand">Marca</Label>
                <Input
                  id="toolBrand"
                  value={form.brand}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, brand: e.target.value }))
                  }
                  placeholder="Lincoln Electric, Bosch..."
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="toolName">Nombre *</Label>
              <Input
                id="toolName"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Categoría</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v as ToolCategory }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOOL_CATEGORIES.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Estado</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as ToolStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Disponible</SelectItem>
                    <SelectItem value="IN_USE">En uso</SelectItem>
                    <SelectItem value="MAINTENANCE">Mantenimiento</SelectItem>
                    <SelectItem value="RETIRED">Dada de baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="toolLocation">Ubicación</Label>
                <Input
                  id="toolLocation"
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location: e.target.value }))
                  }
                  placeholder="Pañol, Box 1..."
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="toolCost">Costo de compra</Label>
                <Input
                  id="toolCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cost: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="toolAcquiredAt">
                Fecha de compra / incorporación
              </Label>
              <Input
                id="toolAcquiredAt"
                type="date"
                value={form.acquiredAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, acquiredAt: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="toolDescription">Descripción</Label>
              <Textarea
                id="toolDescription"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="toolNotes">Notas</Label>
              <Textarea
                id="toolNotes"
                rows={2}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Calibración, accesorios, detalles del mantenimiento..."
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={form.isActive}
                onCheckedChange={(c) =>
                  setForm((f) => ({ ...f, isActive: Boolean(c) }))
                }
              />
              Activa
            </label>
            {formError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{" "}
                <span>{formError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={formBusy}
            >
              Cancelar
            </Button>
            <Button onClick={submitForm} disabled={formBusy} className="gap-2">
              {formBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Asignar */}
      <Dialog
        open={!!assignTool}
        onOpenChange={(v) => {
          if (!v) setAssignTool(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#003b73]" />
              Asignar herramienta
            </DialogTitle>
            <DialogDescription>
              {assignTool && (
                <>
                  <b>{assignTool.name}</b> · código {assignTool.code ?? "—"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Usuario</Label>
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name ?? u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assignError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{" "}
                <span>{assignError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignTool(null)}
              disabled={assignBusy}
            >
              Cancelar
            </Button>
            <Button
              onClick={submitAssign}
              disabled={assignBusy}
              className="gap-2"
            >
              {assignBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Asignando…
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Asignar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Eliminar */}
      <Dialog
        open={!!deleteTool}
        onOpenChange={(v) => {
          if (!v) setDeleteTool(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Eliminar
              herramienta
            </DialogTitle>
            <DialogDescription>
              Acción permanente. Si querés conservar el registro con historial,
              usá <b>Dar de baja</b> en su lugar.
            </DialogDescription>
          </DialogHeader>
          {deleteTool && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">{deleteTool.name}</div>
              {deleteTool.code && (
                <div className="text-xs font-mono text-muted-foreground">
                  {deleteTool.code}
                </div>
              )}
            </div>
          )}
          {deleteError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{" "}
              <span>{deleteError}</span>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTool(null)}
              disabled={deleteBusy}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={submitDelete}
              disabled={deleteBusy}
              className="gap-2"
            >
              {deleteBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Eliminando…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: "blue" | "green" | "orange" | "purple" | "indigo";
}) {
  const palette: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    orange: "bg-orange-500/10 text-orange-500",
    purple: "bg-purple-500/10 text-purple-500",
    indigo: "bg-indigo-500/10 text-indigo-500",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold truncate">{value}</p>
        </div>
        <div
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${palette[color]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
