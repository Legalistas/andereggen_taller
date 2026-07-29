"use client";

/**
 * spec Compras v2 · Base única de proveedores.
 * Se usan desde cotizaciones (BudgetAdminQuote) y desde el flete de las
 * compras (Purchase.freightSupplierId). Sin separar por tipo — un mismo
 * proveedor puede vender repuestos y hacer fletes.
 */

import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  Truck,
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
import { TabHeader } from "../settings-section";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  isActive: true,
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`/api/suppliers?${params.toString()}`);
      // Blindado ante bodies vacíos (500 sin JSON, response corrupto, etc.).
      const raw = await res.text();
      const body = raw ? JSON.parse(raw) : {};
      if (!res.ok) {
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSuppliers(body.suppliers ?? []);
      setTotal(body.pagination?.total ?? 0);
      setTotalPages(body.pagination?.totalPages ?? 1);
    } catch (e) {
      setLoadError(
        e instanceof Error
          ? e.message
          : "No se pudo cargar el listado de proveedores.",
      );
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchSuppliers();
    }, 250);
    return () => clearTimeout(t);
  }, [fetchSuppliers]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
      isActive: s.isActive,
    });
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
        ? `/api/suppliers/${editing.id}`
        : "/api/suppliers";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          notes: form.notes || null,
          isActive: form.isActive,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setFormOpen(false);
      await fetchSuppliers();
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
      const res = await fetch(`/api/suppliers/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        window.alert(b?.error ?? "No se pudo eliminar");
        return;
      }
      setDeleteTarget(null);
      await fetchSuppliers();
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <TabHeader
        title="Proveedores"
        desc="Catálogo único de proveedores del taller. Los mismos proveedores se usan para repuestos y para fletes. Al borrar uno, las cotizaciones y compras históricas conservan el nombre como snapshot."
        icon={Truck}
      />

      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar por nombre, teléfono o email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            setPageSize(Number(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-28 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / pág
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo proveedor
        </Button>
      </div>

      {loadError && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && suppliers.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center py-8 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 inline animate-spin mr-2" />
                Cargando…
              </TableCell>
            </TableRow>
          )}
          {!loading && suppliers.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center py-8 text-sm text-muted-foreground"
              >
                {search
                  ? "Sin resultados para esa búsqueda."
                  : "Sin proveedores cargados todavía."}
              </TableCell>
            </TableRow>
          )}
          {suppliers.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <div className="font-medium">{s.name}</div>
                {s.address && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" /> {s.address}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {s.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {s.phone}
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {s.email}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {s.isActive ? (
                  <Badge
                    variant="outline"
                    className="gap-1 bg-green-500/10 text-green-700 border-green-200"
                  >
                    <div className="h-2 w-2 rounded-full bg-green-500" /> Activo
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1 bg-gray-500/10 text-gray-700 border-gray-200"
                  >
                    <div className="h-2 w-2 rounded-full bg-gray-500" />
                    Inactivo
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(s)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(s)}
                    className="h-8 w-8 p-0 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {total > 0 && (
        <div className="flex items-center justify-between mt-3 text-xs text-slate-600">
          <div>
            Mostrando{" "}
            <strong className="tabular-nums">
              {(page - 1) * pageSize + 1}
            </strong>
            –
            <strong className="tabular-nums">
              {Math.min(page * pageSize, total)}
            </strong>{" "}
            de <strong className="tabular-nums">{total}</strong>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 tabular-nums">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Crear/editar */}
      <Dialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setError(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar proveedor" : "Nuevo proveedor"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Los proveedores se usan para cotizaciones de repuestos y para
              fletes. El nombre es único.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Autopartes Central"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Teléfono</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Dirección</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Notas</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Aclaraciones internas — condiciones de pago, contacto de emergencia, etc."
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-2">
              <div>
                <p className="text-sm font-medium">Activo</p>
                <p className="text-[11px] text-muted-foreground">
                  Los inactivos no aparecen en los desplegables de compras.
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
            </div>
            {error && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setFormOpen(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Guardar cambios" : "Crear proveedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrar */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar proveedor</DialogTitle>
            <DialogDescription>
              ¿Seguro que querés eliminar{" "}
              <strong>{deleteTarget?.name}</strong>? Las cotizaciones y
              compras históricas van a conservar el nombre pero pierden el
              link al proveedor.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteBusy}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={submitDelete}
              disabled={deleteBusy}
            >
              {deleteBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
