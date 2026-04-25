"use client";

import {
  AlertCircle,
  Car,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Vehicle = {
  id: string;
  brand: string;
  model: string;
  year: string;
  domain: string;
  secure: string;
};

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  dni: string | null;
  dniType: string | null;
  city: string;
  cp: string;
  address: string;
  vehicles: Vehicle[];
  createdAt: string;
};

export default function CustomersSection() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Dialog Nuevo Cliente
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dni: "",
    dniType: "DNI",
    city: "",
    cp: "",
    address: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Dialog confirmación de borrado
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/customers?limit=100", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { customers: Customer[] };
      setCustomers(body.customers);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setLoadError(
          e instanceof Error ? e.message : "Error al cargar clientes",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetchCustomers(ac.signal);
    return () => ac.abort();
  }, [fetchCustomers]);

  const filtered = useMemo(() => {
    const t = searchTerm.toLowerCase();
    if (!t) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(t) ||
        c.email.toLowerCase().includes(t) ||
        c.phone.includes(searchTerm) ||
        c.city.toLowerCase().includes(t) ||
        c.dni?.includes(searchTerm),
    );
  }, [customers, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginated = filtered.slice(startIndex, endIndex);

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      dni: "",
      dniType: "DNI",
      city: "",
      cp: "",
      address: "",
    });
    setCreateError(null);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/customers/${toDelete.id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setToDelete(null);
      await fetchCustomers();
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Error al eliminar cliente",
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async () => {
    setCreateError(null);
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setCreateError("Nombre, email y teléfono son obligatorios.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          dni: form.dni.trim() || null,
          dniType: form.dni.trim() ? form.dniType : null,
          city: form.city.trim() || null,
          cp: form.cp.trim() || null,
          address: form.address.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      resetForm();
      setShowNewDialog(false);
      await fetchCustomers();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Error al crear cliente");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Breadcrumbs items={[{ label: "Clientes" }]} />
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Listado de clientes registrados. También se crean automáticamente
            desde Cotizaciones y Producción.
          </p>
        </div>
        <Dialog
          open={showNewDialog}
          onOpenChange={(v) => {
            setShowNewDialog(v);
            if (!v) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuevo cliente</DialogTitle>
              <DialogDescription>
                Datos esenciales. La dirección completa se autocompleta con
                Argentina · Santa Fe · Rafaela y se puede editar después.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="cName">Nombre completo *</Label>
                <Input
                  id="cName"
                  placeholder="Apellido, Nombre"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cEmail">Email *</Label>
                  <Input
                    id="cEmail"
                    type="email"
                    placeholder="cliente@email.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cPhone">Teléfono *</Label>
                  <Input
                    id="cPhone"
                    placeholder="+54 9 3492 155-9075"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cDniType">Doc.</Label>
                  <Select
                    value={form.dniType}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, dniType: v }))
                    }
                  >
                    <SelectTrigger id="cDniType">
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
                <div className="grid gap-1.5">
                  <Label htmlFor="cDni">Número (opcional)</Label>
                  <Input
                    id="cDni"
                    placeholder="12345678"
                    value={form.dni}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dni: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cCity">Ciudad</Label>
                  <Input
                    id="cCity"
                    placeholder="Rafaela"
                    value={form.city}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, city: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cCp">CP</Label>
                  <Input
                    id="cCp"
                    placeholder="2300"
                    value={form.cp}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cp: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="cAddress">Dirección</Label>
                <Input
                  id="cAddress"
                  placeholder="Calle 123"
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
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
                    <Plus className="h-4 w-4" /> Crear cliente
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats reales */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Clientes</p>
              <p className="text-2xl font-bold tabular-nums">
                {customers.length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total Vehículos</p>
              <p className="text-2xl font-bold tabular-nums">
                {customers.reduce((a, c) => a + c.vehicles.length, 0)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Car className="h-5 w-5 text-purple-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Con datos de contacto
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {customers.filter((c) => c.email && c.phone).length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email, teléfono, DNI o ciudad…"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9"
          />
        </div>
      </Card>

      {loadError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <Card className="py-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Vehículos</TableHead>
              <TableHead>Registrado</TableHead>
              <TableHead className="w-12 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && customers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-sm text-muted-foreground"
                >
                  <Loader2 className="h-4 w-4 inline animate-spin mr-2" />
                  Cargando clientes…
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-sm text-muted-foreground italic"
                >
                  {searchTerm
                    ? "Sin clientes que coincidan con la búsqueda."
                    : "Todavía no hay clientes registrados."}
                </TableCell>
              </TableRow>
            )}
            {paginated.map((c) => (
              <TableRow key={c.id} className="hover:bg-slate-50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="font-medium">{c.name}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    {c.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {c.dni ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        {c.dniType ?? "DNI"}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {c.dni}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span>{c.city}</span>
                  </div>
                  {c.cp && c.cp !== "-" && (
                    <div className="text-xs text-muted-foreground">
                      CP: {c.cp}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {c.vehicles.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">—</span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1 text-sm">
                        <Car className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{c.vehicles.length}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-40">
                        {c.vehicles[0].brand} {c.vehicles[0].model}
                        {c.vehicles.length > 1
                          ? ` +${c.vehicles.length - 1}`
                          : ""}
                      </div>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setDeleteError(null);
                      setToDelete(c);
                    }}
                    aria-label={`Eliminar ${c.name}`}
                    title="Eliminar cliente"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 gap-4 flex-wrap">
            <div className="text-xs text-muted-foreground">
              Mostrando {startIndex + 1} a {Math.min(endIndex, filtered.length)}{" "}
              de {filtered.length} cliente{filtered.length === 1 ? "" : "s"}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">por página</span>
              {[10, 25, 50].map((n) => (
                <Button
                  key={n}
                  variant={itemsPerPage === n ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setItemsPerPage(n);
                    setCurrentPage(1);
                  }}
                >
                  {n}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 px-2"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="h-7 px-2"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog
        open={toDelete !== null}
        onOpenChange={(v) => {
          if (!v && !deleting) {
            setToDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar cliente</DialogTitle>
            <DialogDescription>
              Vas a eliminar <strong>{toDelete?.name}</strong> y todos sus datos
              asociados (vehículos, leads y presupuestos). Las reparaciones
              quedarán como histórico sin cliente vinculado. Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>

          {toDelete && toDelete.vehicles.length > 0 && (
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Se eliminarán también <strong>{toDelete.vehicles.length}</strong>{" "}
              vehículo{toDelete.vehicles.length === 1 ? "" : "s"} y todos los
              presupuestos asociados.
            </div>
          )}

          {deleteError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setToDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Eliminando…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> Eliminar definitivamente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
