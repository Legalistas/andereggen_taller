"use client";

import {
  AlertCircle,
  Car,
  ChevronRight,
  Edit,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabHeader } from "../settings-section";

type Brand = {
  id: string;
  name: string;
  isActive: boolean;
  _count: { models: number };
};

type Model = {
  id: string;
  name: string;
  brandId: string;
  isActive: boolean;
  brand: { id: string; name: string };
};

export default function VehiclesTab() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const fetchBrands = useCallback(async () => {
    setLoadingBrands(true);
    setBrandsError(null);
    try {
      const res = await fetch("/api/vehicle-brands");
      const text = await res.text();
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error) msg = parsed.error;
        } catch {
          // respuesta no-JSON (ej: 500 con HTML)
        }
        throw new Error(msg);
      }
      const body = text ? JSON.parse(text) : {};
      setBrands(body.brands ?? []);
    } catch (e) {
      setBrandsError(e instanceof Error ? e.message : "Error al cargar marcas");
    } finally {
      setLoadingBrands(false);
    }
  }, []);

  const fetchModels = useCallback(async (brandId: string) => {
    setLoadingModels(true);
    setModelsError(null);
    try {
      const res = await fetch(`/api/vehicle-models?brandId=${brandId}`);
      const text = await res.text();
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error) msg = parsed.error;
        } catch {}
        throw new Error(msg);
      }
      const body = text ? JSON.parse(text) : {};
      setModels(body.models ?? []);
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : "Error al cargar modelos");
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  useEffect(() => {
    if (selectedBrandId) fetchModels(selectedBrandId);
    else setModels([]);
  }, [selectedBrandId, fetchModels]);

  const selectedBrand = brands.find((b) => b.id === selectedBrandId) ?? null;

  return (
    <Card className="p-6">
      <TabHeader
        title="Catálogo de vehículos"
        desc="Marcas y modelos que aparecen como autocomplete al cargar un vehículo. Podés agregar los que falten."
        icon={Car}
      />

      {(brandsError || modelsError) && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            {brandsError && <p>Marcas: {brandsError}</p>}
            {modelsError && <p>Modelos: {modelsError}</p>}
            <p className="text-xs text-destructive/70 mt-0.5">
              Si acabás de agregar el schema, reiniciá el dev server para que
              Prisma recargue.
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-[340px_1fr] gap-6">
        {/* Columna de marcas */}
        <BrandsColumn
          brands={brands}
          loading={loadingBrands}
          selectedId={selectedBrandId}
          onSelect={setSelectedBrandId}
          onReload={fetchBrands}
        />

        {/* Columna de modelos */}
        <ModelsColumn
          brand={selectedBrand}
          models={models}
          loading={loadingModels}
          onReload={() => selectedBrandId && fetchModels(selectedBrandId)}
        />
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Marcas
// ─────────────────────────────────────────────────────────────

function BrandsColumn({
  brands,
  loading,
  selectedId,
  onSelect,
  onReload,
}: {
  brands: Brand[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReload: () => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState({ name: "", isActive: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", isActive: true });
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (b: Brand) => {
    setEditing(b);
    setForm({ name: b.name, isActive: b.isActive });
    setError(null);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = editing
        ? `/api/vehicle-brands/${editing.id}`
        : "/api/vehicle-brands";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          isActive: form.isActive,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setFormOpen(false);
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/vehicle-brands/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setDeleteTarget(null);
      await onReload();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Error");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Marcas</h3>
        <Button size="sm" onClick={openCreate} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" /> Nueva
        </Button>
      </div>

      <div className="rounded-lg border bg-slate-50/50 max-h-125 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
          </div>
        )}
        {!loading && brands.length === 0 && (
          <p className="py-10 text-center text-xs text-muted-foreground italic">
            Sin marcas cargadas.
          </p>
        )}
        {brands.map((b) => {
          const selected = selectedId === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onSelect(b.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm border-b border-slate-100 last:border-0 transition-colors text-left ${
                selected
                  ? "bg-[#003b73] text-white"
                  : b.isActive
                    ? "hover:bg-white"
                    : "hover:bg-white text-slate-400"
              }`}
            >
              <Car
                className={`h-4 w-4 shrink-0 ${
                  selected
                    ? "text-white"
                    : b.isActive
                      ? "text-slate-400"
                      : "text-slate-300"
                }`}
              />
              <span className="font-medium flex-1 truncate">{b.name}</span>
              <Badge
                variant="outline"
                className={`text-[10px] h-5 px-1.5 font-normal ${
                  selected
                    ? "bg-white/15 border-white/30 text-white"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
              >
                {b._count.models}
              </Badge>
              {!b.isActive && (
                <Badge
                  variant="outline"
                  className="text-[9px] h-5 px-1.5 font-normal bg-slate-100 border-slate-200 text-slate-500"
                >
                  Inactiva
                </Badge>
              )}
              <span className="flex items-center gap-0.5">
                <ActionIcon
                  title="Editar"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(b);
                  }}
                  selected={selected}
                  icon={Edit}
                />
                <ActionIcon
                  title="Eliminar"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(b);
                  }}
                  selected={selected}
                  icon={Trash2}
                  danger
                />
              </span>
              <ChevronRight
                className={`h-3.5 w-3.5 shrink-0 ${
                  selected ? "text-white" : "text-slate-300"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Dialog crear/editar */}
      <Dialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setError(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar marca" : "Nueva marca"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="brandName">Nombre *</Label>
              <Input
                id="brandName"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Ej: Toyota"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="brandActive" className="cursor-pointer">
                Activa
              </Label>
              <Switch
                id="brandActive"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button onClick={submit} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog eliminar */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar marca</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  ¿Eliminar <b>{deleteTarget.name}</b>? Se eliminan también sus{" "}
                  <b>{deleteTarget._count.models}</b> modelo(s).
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
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
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionIcon({
  icon: Icon,
  title,
  onClick,
  selected,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  selected: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
        selected
          ? "hover:bg-white/20 text-white"
          : danger
            ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Modelos
// ─────────────────────────────────────────────────────────────

function ModelsColumn({
  brand,
  models,
  loading,
  onReload,
}: {
  brand: Brand | null;
  models: Model[];
  loading: boolean;
  onReload: () => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Model | null>(null);
  const [form, setForm] = useState({ name: "", isActive: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Model | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  if (!brand) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-slate-50/30 flex items-center justify-center text-sm text-muted-foreground min-h-60 text-center px-6">
        Elegí una marca a la izquierda para ver y administrar sus modelos.
      </div>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", isActive: true });
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (m: Model) => {
    setEditing(m);
    setForm({ name: m.name, isActive: m.isActive });
    setError(null);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const url = editing
        ? `/api/vehicle-models/${editing.id}`
        : "/api/vehicle-models";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          ...(editing ? {} : { brandId: brand.id }),
          isActive: form.isActive,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setFormOpen(false);
      onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await fetch(`/api/vehicle-models/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      onReload();
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Modelos de <span className="text-[#003b73]">{brand.name}</span>
        </h3>
        <Button size="sm" onClick={openCreate} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" /> Nuevo modelo
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Modelo</TableHead>
            <TableHead className="w-24">Estado</TableHead>
            <TableHead className="w-28 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-center py-6 text-xs text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 inline animate-spin mr-2" />{" "}
                Cargando…
              </TableCell>
            </TableRow>
          )}
          {!loading && models.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-center py-6 text-xs text-muted-foreground italic"
              >
                Esta marca no tiene modelos todavía.
              </TableCell>
            </TableRow>
          )}
          {models.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell>
                {m.isActive ? (
                  <Badge
                    variant="outline"
                    className="gap-1 bg-green-500/10 text-green-700 border-green-200 text-[10px] h-5"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />{" "}
                    Activo
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1 bg-gray-500/10 text-gray-700 border-gray-200 text-[10px] h-5"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-500" />{" "}
                    Inactivo
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(m)}
                    className="h-7 w-7 p-0"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(m)}
                    className="h-7 w-7 p-0 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Dialog crear/editar modelo */}
      <Dialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setError(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar modelo" : `Nuevo modelo de ${brand.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="modelName">Nombre *</Label>
              <Input
                id="modelName"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Ej: Corolla"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="modelActive" className="cursor-pointer">
                Activo
              </Label>
              <Switch
                id="modelActive"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button onClick={submit} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog eliminar modelo */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar modelo</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  ¿Eliminar <b>{deleteTarget.name}</b> de <b>{brand.name}</b>?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
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
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
