"use client";

import { AlertCircle, Edit, Loader2, Plus, Trash2, Wallet } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type Concept = {
  id: string;
  label: string;
  parentId: string | null;
  order: number;
  isActive: boolean;
  children: Concept[];
};

const ROOT = "__root__";

/** Rubros de egreso de la Caja: alta, edición, baja y subcategorías. */
export default function CashConceptsTab() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Concept | null>(null);
  const [form, setForm] = useState({ label: "", parentId: ROOT, order: "100", isActive: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Concept | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchConcepts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cash-concepts");
      const body = await res.json();
      setConcepts(body.concepts ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConcepts();
  }, [fetchConcepts]);

  const openCreate = (parentId: string = ROOT) => {
    setEditing(null);
    setForm({ label: "", parentId, order: "100", isActive: true });
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (c: Concept) => {
    setEditing(c);
    setForm({ label: c.label, parentId: c.parentId ?? ROOT, order: String(c.order), isActive: c.isActive });
    setError(null);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.label.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        label: form.label.trim(),
        order: Number(form.order || 100),
        isActive: form.isActive,
      };
      if (!editing) payload.parentId = form.parentId === ROOT ? null : form.parentId;
      const res = await fetch(editing ? `/api/cash-concepts/${editing.id}` : "/api/cash-concepts", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setFormOpen(false);
      await fetchConcepts();
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
      await fetch(`/api/cash-concepts/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await fetchConcepts();
    } finally {
      setDeleteBusy(false);
    }
  };

  const row = (c: Concept, sub: boolean) => (
    <TableRow key={c.id}>
      <TableCell className={sub ? "pl-10 text-sm text-slate-700" : "font-medium"}>
        {sub && <span className="text-slate-400 mr-1.5">↳</span>}
        {c.label}
      </TableCell>
      <TableCell className="text-right text-sm">{c.order}</TableCell>
      <TableCell>
        {c.isActive ? (
          <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 border-green-200">
            <div className="h-2 w-2 rounded-full bg-green-500" /> Activo
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 bg-gray-500/10 text-gray-700 border-gray-200">
            <div className="h-2 w-2 rounded-full bg-gray-500" /> Inactivo
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {!sub && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openCreate(c.id)}
              className="h-8 text-xs gap-1"
              title="Agregar subcategoría"
            >
              <Plus className="h-3.5 w-3.5" /> Sub
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => openEdit(c)} className="h-8 w-8 p-0">
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget(c)}
            className="h-8 w-8 p-0 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <Card className="p-6">
      <TabHeader
        title="Rubros de caja"
        desc="Conceptos de egreso que ofrece la Caja al cargar un gasto (Sueldos, Brixar, Impuestos…). Un rubro puede tener subcategorías. Los movimientos ya cargados conservan el texto aunque el rubro se edite o se borre."
        icon={Wallet}
      />

      <div className="flex justify-end mb-4">
        <Button onClick={() => openCreate()} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo rubro
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rubro</TableHead>
            <TableHead className="w-20 text-right">Orden</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && concepts.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Cargando…
              </TableCell>
            </TableRow>
          )}
          {!loading && concepts.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                Sin rubros todavía.
              </TableCell>
            </TableRow>
          )}
          {concepts.flatMap((c) => [row(c, false), ...c.children.map((s) => row(s, true))])}
        </TableBody>
      </Table>

      <Dialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setError(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? <Edit className="h-5 w-5 text-[#003b73]" /> : <Plus className="h-5 w-5 text-[#003b73]" />}
              {editing ? "Editar rubro" : "Nuevo rubro"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Renombrar no cambia los movimientos ya cargados."
                : "Dejalo sin padre para un rubro principal, o elegí uno para crear una subcategoría."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ccLabel">Nombre *</Label>
              <Input
                id="ccLabel"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ej: Publicidad"
              />
            </div>
            {!editing && (
              <div className="grid gap-1.5">
                <Label>Rubro padre</Label>
                <Select value={form.parentId} onValueChange={(v) => setForm((f) => ({ ...f, parentId: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ROOT}>— Ninguno (rubro principal) —</SelectItem>
                    {concepts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5 max-w-32">
              <Label htmlFor="ccOrder">Orden</Label>
              <Input
                id="ccOrder"
                type="number"
                value={form.order}
                onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <Label htmlFor="ccActive" className="cursor-pointer">
                Activo
              </Label>
              <Switch
                id="ccActive"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={busy} className="gap-2">
              {busy ? (
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

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar rubro</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  ¿Eliminar <b>{deleteTarget.label}</b>
                  {deleteTarget.children.length > 0 && ` y sus ${deleteTarget.children.length} subcategorías`}?
                  Los movimientos ya cargados con este rubro conservan el texto; solo deja de ofrecerse al cargar.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={submitDelete} disabled={deleteBusy} className="gap-2">
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
    </Card>
  );
}
