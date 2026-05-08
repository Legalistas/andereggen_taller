"use client";

import {
  AlertCircle,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Send,
  TrendingUp,
  Trophy,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BudgetHistoryButton } from "@/components/crm/budget-history-button";
import BudgetModal from "@/components/crm/budget-modal";
import CustomerSelector, {
  type Customer,
} from "@/components/crm/customer-selector";
import VehicleForm from "@/components/crm/vehicle-form";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
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
import type { BudgetStatus } from "../../../generated/prisma/client";

type QuoteLite = {
  id: string;
  leadId: string;
  number: number;
  status: BudgetStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleDomain: string;
  laborTotal: string | number;
  partsSubtotal: string | number;
  grandTotal: string | number;
  validityDays: number;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type BudgetDetail = QuoteLite & {
  customerDni: string | null;
  customerAddress: string | null;
  vehicleChassis: string | null;
  vehiclePerladoTricapa: boolean;
  vehicleInsurance: string | null;
  observations: string | null;
  paymentCondition: string;
  deliveryDays: number;
  laborSubtotal: string | number;
  ivaRate: string | number;
  ivaAmount: string | number;
  concepts: Array<{
    id: string;
    type: "DESCRIPTIVO" | "UNIDADES" | "FIJO";
    category: string;
    order: number;
    subdetails: string[];
    additionalDetail: string | null;
    units: string | number | null;
    unitValue: string | number | null;
    fixedAmount: string | number | null;
    fixedDescription: string | null;
    subtotal: string | number;
  }>;
  parts: Array<{
    id: string;
    order: number;
    quantity: string | number;
    description: string;
    unitPrice: string | number;
    subtotal: string | number;
  }>;
};

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const ARS_PRECISE = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});
const INT = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

type StatusStyle = {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
};
const STATUS_CONFIG: Record<BudgetStatus, StatusStyle> = {
  draft: {
    label: "Borrador",
    color: "bg-slate-500/10 text-slate-700 border-slate-200",
    icon: FileText,
  },
  sent: {
    label: "Enviado",
    color: "bg-cyan-500/10 text-cyan-700 border-cyan-200",
    icon: Send,
  },
  accepted: {
    label: "Aceptado",
    color: "bg-green-500/10 text-green-700 border-green-200",
    icon: Trophy,
  },
  rejected: {
    label: "Rechazado",
    color: "bg-red-500/10 text-red-700 border-red-200",
    icon: XCircle,
  },
  expired: {
    label: "Vencido",
    color: "bg-gray-500/10 text-gray-700 border-gray-200",
    icon: Calendar,
  },
};

const ALLOWED_TRANSITIONS: Record<BudgetStatus, BudgetStatus[]> = {
  draft: ["sent"],
  sent: ["accepted", "rejected", "expired"],
  accepted: [],
  rejected: [],
  expired: [],
};

export default function QuotesSection() {
  const [quotes, setQuotes] = useState<QuoteLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BudgetStatus | "all">("all");
  const [periodFilter, setPeriodFilter] = useState<
    "all" | "7d" | "30d" | "90d"
  >("all");

  // New quote flow
  const [newOpen, setNewOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Customer | null>(null);
  const [newVehicleMode, setNewVehicleMode] = useState<string | "new" | "">("");
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newPlate, setNewPlate] = useState("");
  const [newInsurance, setNewInsurance] = useState("");
  const [newThirdPartyInsurance, setNewThirdPartyInsurance] = useState("");
  const [newBusy, setNewBusy] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);
  const [budgetLeadId, setBudgetLeadId] = useState<string | null>(null);

  // Detalle
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BudgetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────
  const fetchQuotes = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (periodFilter !== "all") {
          const days =
            periodFilter === "7d" ? 7 : periodFilter === "30d" ? 30 : 90;
          const from = new Date(Date.now() - days * 86400_000);
          params.set("dateFrom", from.toISOString());
        }
        const res = await fetch(`/api/budgets?${params}`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { budgets: QuoteLite[] };
        setQuotes(data.budgets);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setLoadError(
            e instanceof Error ? e.message : "Error al cargar cotizaciones",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, periodFilter],
  );

  useEffect(() => {
    const ac = new AbortController();
    const t = setTimeout(() => fetchQuotes(ac.signal), 200);
    return () => {
      ac.abort();
      clearTimeout(t);
    };
  }, [fetchQuotes]);

  // Fetch de detalle cuando se abre
  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      setStatusError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/budgets/${detailId}`)
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled && body?.budget) setDetail(body.budget as BudgetDetail);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  // ── Stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = quotes.length;
    const sent = quotes.filter((q) => q.status === "sent").length;
    const accepted = quotes.filter((q) => q.status === "accepted").length;
    const rejected = quotes.filter((q) => q.status === "rejected").length;
    const conversion = total === 0 ? 0 : Math.round((accepted / total) * 100);
    const pipeline = quotes
      .filter((q) => q.status === "sent")
      .reduce((acc, q) => acc + Number(q.grandTotal), 0);
    const accepted_amount = quotes
      .filter((q) => q.status === "accepted")
      .reduce((acc, q) => acc + Number(q.grandTotal), 0);
    return {
      total,
      sent,
      accepted,
      rejected,
      conversion,
      pipeline,
      accepted_amount,
    };
  }, [quotes]);

  // ── New quote flow ────────────────────────────────────────────
  const resetNewForm = () => {
    setNewCustomer(null);
    setNewVehicleMode("");
    setNewBrand("");
    setNewModel("");
    setNewYear("");
    setNewPlate("");
    setNewInsurance("");
    setNewThirdPartyInsurance("");
    setNewError(null);
  };

  const handleContinueToQuote = async () => {
    setNewError(null);
    if (!newCustomer) {
      setNewError("Seleccioná un cliente.");
      return;
    }

    const payload: Record<string, unknown> = {
      customerId: newCustomer.id,
      status: "control", // presupuestos "aparte" arrancan en control
      source: "cotizacion",
      notes: "Cotización creada desde /crm/cotizaciones",
    };

    if (newVehicleMode === "new") {
      if (!newBrand || !newModel || !newYear || !newPlate) {
        setNewError("Completá marca, modelo, año y patente del vehículo.");
        return;
      }
      payload.newVehicle = {
        brand: newBrand,
        model: newModel,
        year: newYear,
        domain: newPlate,
        secure: newInsurance,
        thirdPartySecure: newThirdPartyInsurance,
      };
    } else if (newVehicleMode) {
      payload.vehicleId = newVehicleMode;
    } else {
      setNewError("Seleccioná un vehículo o agregá uno nuevo.");
      return;
    }

    setNewBusy(true);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      const createdLeadId = body?.lead?.id as string | undefined;
      if (!createdLeadId) throw new Error("La API no devolvió el leadId");

      // Cerramos este dialog y abrimos el BudgetModal con ese lead
      setNewOpen(false);
      resetNewForm();
      setBudgetLeadId(createdLeadId);
    } catch (e) {
      setNewError(e instanceof Error ? e.message : "Error");
    } finally {
      setNewBusy(false);
    }
  };

  // ── Acciones por fila ─────────────────────────────────────────
  const changeStatus = async (id: string, status: BudgetStatus) => {
    setStatusBusy(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/budgets/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      if (body.stockWarnings && body.stockWarnings.length > 0) {
        alert(
          "Cotización aceptada, pero hay alertas de stock:\n\n" +
            body.stockWarnings.join("\n"),
        );
      }
      await fetchQuotes();
      if (detailId === id) {
        const d = await fetch(`/api/budgets/${id}`).then((r) => r.json());
        setDetail(d.budget as BudgetDetail);
      }
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Error");
    } finally {
      setStatusBusy(false);
    }
  };

  const duplicateQuote = async (id: string) => {
    const res = await fetch(`/api/budgets/${id}/duplicate`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(body?.error ?? "No se pudo duplicar la cotización");
      return;
    }
    await fetchQuotes();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Breadcrumbs
            items={[{ label: "Cotizaciones" }, { label: "Presupuestos" }]}
          />
          <h1 className="text-3xl font-bold">Presupuestos</h1>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            resetNewForm();
            setNewOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nuevo presupuesto
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Emitidas"
          value={String(stats.total)}
          icon={FileText}
          color="blue"
        />
        <StatCard
          label="Enviadas"
          value={String(stats.sent)}
          icon={Send}
          color="cyan"
        />
        <StatCard
          label="Aceptadas"
          value={String(stats.accepted)}
          icon={Trophy}
          color="green"
        />
        <StatCard
          label="Tasa conversión"
          value={`${stats.conversion}%`}
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          label="Pipeline $"
          value={ARS.format(stats.pipeline)}
          icon={Calendar}
          color="orange"
        />
      </div>

      {/* Filtros */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Input
            placeholder="Buscar por cliente, email o patente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:max-w-md"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchQuotes()}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as BudgetStatus | "all")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="accepted">Aceptado</SelectItem>
                <SelectItem value="rejected">Rechazado</SelectItem>
                <SelectItem value="expired">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select
              value={periodFilter}
              onValueChange={(v) => setPeriodFilter(v as typeof periodFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las fechas</SelectItem>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="30d">Últimos 30 días</SelectItem>
                <SelectItem value="90d">Últimos 90 días</SelectItem>
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
              <TableHead>#</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Vehículo</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && quotes.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  <Loader2 className="h-5 w-5 inline animate-spin mr-2" />{" "}
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!loading && quotes.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-10 text-sm text-muted-foreground"
                >
                  Sin cotizaciones para mostrar.
                </TableCell>
              </TableRow>
            )}
            {quotes.map((q) => {
              const s = STATUS_CONFIG[q.status];
              const Icon = s.icon;
              const allowed = ALLOWED_TRANSITIONS[q.status];
              return (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-sm">
                    #{q.number}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{q.customerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {q.customerEmail}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Car className="h-3 w-3 text-muted-foreground" />
                      {q.vehicleBrand} {q.vehicleModel}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {q.vehicleDomain}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(q.createdAt).toLocaleDateString("es-AR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`gap-1 ${s.color}`}>
                      <Icon className="h-3 w-3" /> {s.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {ARS.format(Number(q.grandTotal))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setDetailId(q.id)}
                      >
                        <Eye className="h-4 w-4" /> Ver
                      </Button>
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
                          {allowed.includes("sent") && (
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => changeStatus(q.id, "sent")}
                            >
                              <Send className="h-4 w-4 text-cyan-600" /> Marcar
                              enviado
                            </DropdownMenuItem>
                          )}
                          {allowed.includes("accepted") && (
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => changeStatus(q.id, "accepted")}
                            >
                              <CheckCircle2 className="h-4 w-4 text-green-600" />{" "}
                              Marcar aceptado
                            </DropdownMenuItem>
                          )}
                          {allowed.includes("rejected") && (
                            <DropdownMenuItem
                              className="gap-2 text-destructive"
                              onClick={() => changeStatus(q.id, "rejected")}
                            >
                              <XCircle className="h-4 w-4" /> Marcar rechazado
                            </DropdownMenuItem>
                          )}
                          {allowed.includes("expired") && (
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => changeStatus(q.id, "expired")}
                            >
                              <Calendar className="h-4 w-4 text-gray-600" />{" "}
                              Marcar vencido
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() => duplicateQuote(q.id)}
                          >
                            <Copy className="h-4 w-4" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              href="/crm/leads"
                              className="gap-2 flex items-center w-full"
                            >
                              <Eye className="h-4 w-4" /> Ir al lead
                            </Link>
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

      {/* Dialog: Nueva cotización */}
      <Dialog
        open={newOpen}
        onOpenChange={(v) => {
          setNewOpen(v);
          if (!v) resetNewForm();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#003b73]" />
              Nueva cotización
            </DialogTitle>
            <DialogDescription>
              Elegí cliente y vehículo. Al continuar se crea el lead (en
              "control") y se abre el editor de presupuesto.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <CustomerSelector
              selectedCustomer={newCustomer}
              onCustomerSelect={(c) => {
                setNewCustomer(c);
                setNewVehicleMode(c?.vehicles?.[0]?.id ?? "new");
              }}
            />

            {newCustomer && (
              <div className="space-y-3">
                <Label>Vehículo</Label>
                <Select
                  value={newVehicleMode}
                  onValueChange={setNewVehicleMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar vehículo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {newCustomer.vehicles?.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.brand} {v.model} {v.year} — {v.domain}
                      </SelectItem>
                    ))}
                    <SelectItem value="new">+ Vehículo nuevo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {newVehicleMode === "new" && (
              <VehicleForm
                brand={newBrand}
                model={newModel}
                year={newYear}
                plate={newPlate}
                insurance={newInsurance}
                thirdPartyInsurance={newThirdPartyInsurance}
                onBrandChange={setNewBrand}
                onModelChange={setNewModel}
                onYearChange={setNewYear}
                onPlateChange={setNewPlate}
                onInsuranceChange={setNewInsurance}
                onThirdPartyInsuranceChange={setNewThirdPartyInsurance}
              />
            )}

            {newError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{" "}
                <span>{newError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewOpen(false)}
              disabled={newBusy}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleContinueToQuote}
              disabled={newBusy}
              className="gap-2"
            >
              {newBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creando…
                </>
              ) : (
                <>
                  Continuar al presupuesto <Check className="h-4 w-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BudgetModal controlado — se abre después del flow de nueva cotización */}
      <BudgetModal
        leadId={budgetLeadId ?? undefined}
        hideTrigger
        open={budgetLeadId !== null}
        onOpenChange={(v) => {
          if (!v) setBudgetLeadId(null);
        }}
        onSaved={() => {
          setBudgetLeadId(null);
          fetchQuotes();
        }}
      />

      {/* Dialog: Detalle read-only */}
      <Dialog
        open={!!detailId}
        onOpenChange={(v) => {
          if (!v) setDetailId(null);
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
          {/* Header con status + fechas en una sola fila */}
          <DialogHeader className="px-6 py-4 border-b bg-card shrink-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <div className="h-9 w-9 rounded-lg bg-[#003b73]/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-[#003b73]" />
                </div>
                Cotización #{detail?.number ?? "…"}
              </DialogTitle>
              {detail && (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`gap-1 ${STATUS_CONFIG[detail.status].color}`}
                  >
                    {STATUS_CONFIG[detail.status].label}
                  </Badge>
                  <BudgetHistoryButton
                    budgetId={detail.id}
                    budgetNumber={detail.number}
                    variant="label"
                  />
                </div>
              )}
            </div>
            <DialogDescription className="text-xs flex flex-wrap gap-x-3 gap-y-0.5">
              {detail && (
                <>
                  <span>
                    Creada:{" "}
                    {new Date(detail.createdAt).toLocaleString("es-AR")}
                  </span>
                  {detail.sentAt && (
                    <span>
                      · Enviada:{" "}
                      {new Date(detail.sentAt).toLocaleString("es-AR")}
                    </span>
                  )}
                  {detail.acceptedAt && (
                    <span className="text-green-600">
                      · Aceptada:{" "}
                      {new Date(detail.acceptedAt).toLocaleString("es-AR")}
                    </span>
                  )}
                  {detail.rejectedAt && (
                    <span className="text-destructive">
                      · Rechazada:{" "}
                      {new Date(detail.rejectedAt).toLocaleString("es-AR")}
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Body scrolleable */}
          <div className="flex-1 overflow-y-auto px-6 py-5 bg-muted/20">
            {detailLoading && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Cargando…
              </div>
            )}

            {!detailLoading && detail && (
              <div className="space-y-5">
                {/* Cliente + Vehículo en cards prolijas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-white p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                      <User className="h-3 w-3" /> Cliente
                    </div>
                    <div className="font-semibold text-slate-900">
                      {detail.customerName}
                    </div>
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="break-all">
                          {detail.customerEmail}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                        {detail.customerPhone}
                      </div>
                      {detail.customerDni && (
                        <div className="text-slate-500">
                          DNI: {detail.customerDni}
                        </div>
                      )}
                      {detail.customerAddress &&
                        detail.customerAddress !== "-" && (
                          <div className="text-slate-500">
                            Dirección: {detail.customerAddress}
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-white p-4 space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                      <Car className="h-3 w-3" /> Vehículo
                    </div>
                    <div className="font-semibold text-slate-900">
                      {detail.vehicleBrand} {detail.vehicleModel}{" "}
                      {detail.vehicleYear}
                    </div>
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="font-mono text-slate-700">
                        {detail.vehicleDomain}
                      </div>
                      {detail.vehicleChassis && (
                        <div className="font-mono text-slate-500">
                          Chasis: {detail.vehicleChassis}
                        </div>
                      )}
                      {detail.vehiclePerladoTricapa && (
                        <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 border border-amber-200 text-amber-800 font-bold uppercase tracking-wider text-[11px]">
                          PERLADO TRICAPA
                        </div>
                      )}
                      {detail.vehicleInsurance && (
                        <div className="text-slate-500">
                          Seguro: {detail.vehicleInsurance}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Conceptos */}
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    Conceptos ({detail.concepts.length})
                  </div>
                  {detail.concepts.length === 0 ? (
                    <div className="text-xs italic text-muted-foreground">
                      Sin conceptos.
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-white divide-y">
                      {detail.concepts.map((c) => (
                        <div
                          key={c.id}
                          className="px-4 py-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm text-slate-900">
                              {c.category.replaceAll("_", " ")}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {c.type === "DESCRIPTIVO" &&
                                (c.subdetails.length > 0
                                  ? `${c.subdetails.length} subdetalles seleccionados`
                                  : "sin subdetalles")}
                              {c.type === "UNIDADES" &&
                                (Number(c.units) > 0 && Number(c.unitValue) > 0
                                  ? `${INT.format(Number(c.units))} × ${ARS_PRECISE.format(Number(c.unitValue))}`
                                  : "Importe directo")}
                              {c.type === "FIJO" &&
                                (c.fixedDescription ?? "Importe fijo")}
                            </div>
                          </div>
                          {c.type !== "DESCRIPTIVO" && (
                            <div className="text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                              {ARS_PRECISE.format(Number(c.subtotal))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Repuestos */}
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    Repuestos ({detail.parts.length})
                  </div>
                  {detail.parts.length === 0 ? (
                    <div className="text-xs italic text-muted-foreground">
                      Sin repuestos.
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-white overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">Cant.</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="w-32 text-right">
                              P. unitario
                            </TableHead>
                            <TableHead className="w-32 text-right">
                              Subtotal
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.parts.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="text-sm tabular-nums">
                                {INT.format(Number(p.quantity))}
                              </TableCell>
                              <TableCell className="text-sm">
                                {p.description}
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums">
                                {ARS_PRECISE.format(Number(p.unitPrice))}
                              </TableCell>
                              <TableCell className="text-right text-sm font-semibold tabular-nums">
                                {ARS_PRECISE.format(Number(p.subtotal))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                {/* Totales: card alineada a la derecha */}
                <div className="flex justify-end">
                  <div className="w-full sm:w-auto sm:min-w-[320px] rounded-lg border bg-white p-4">
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between gap-6">
                        <dt className="text-slate-500">Subtotal MO</dt>
                        <dd className="tabular-nums">
                          {ARS_PRECISE.format(Number(detail.laborSubtotal))}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-6">
                        <dt className="text-slate-500">
                          IVA {Number(detail.ivaRate)}%
                        </dt>
                        <dd className="tabular-nums">
                          {ARS_PRECISE.format(Number(detail.ivaAmount))}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-6">
                        <dt className="text-slate-500">MO con IVA</dt>
                        <dd className="tabular-nums">
                          {ARS_PRECISE.format(Number(detail.laborTotal))}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-6">
                        <dt className="text-slate-500">Repuestos</dt>
                        <dd className="tabular-nums">
                          {ARS_PRECISE.format(Number(detail.partsSubtotal))}
                        </dd>
                      </div>
                      <div className="border-t pt-2 mt-2 flex justify-between items-baseline gap-6">
                        <dt className="font-bold">TOTAL</dt>
                        <dd className="font-bold text-lg text-[#003b73] tabular-nums">
                          {ARS_PRECISE.format(Number(detail.grandTotal))}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Observaciones */}
                <div className="rounded-lg border bg-white px-4 py-3 text-xs text-slate-600 space-y-1">
                  <div>
                    <span className="font-medium text-slate-700">Validez:</span>{" "}
                    {detail.validityDays} días ·{" "}
                    <span className="font-medium text-slate-700">Entrega:</span>{" "}
                    {detail.deliveryDays} días ·{" "}
                    <span className="font-medium text-slate-700">Pago:</span>{" "}
                    {detail.paymentCondition}
                  </div>
                  {detail.observations && (
                    <div className="italic mt-1 text-slate-500 border-t pt-1.5">
                      {detail.observations}
                    </div>
                  )}
                </div>

                {statusError && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{" "}
                    <span>{statusError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-wrap gap-2 px-6 py-3 border-t bg-card shrink-0">
            <Button variant="outline" onClick={() => setDetailId(null)}>
              Cerrar
            </Button>
            {detail && (
              <Button
                variant="outline"
                asChild
                className="gap-2"
                title="Descargar PDF del presupuesto"
              >
                <a
                  href={`/api/budgets/${detail.id}/pdf`}
                  target="_blank"
                  rel="noopener"
                >
                  <Download className="h-4 w-4" /> Descargar PDF
                </a>
              </Button>
            )}
            {detail && ALLOWED_TRANSITIONS[detail.status].length > 0 && (
              <>
                {ALLOWED_TRANSITIONS[detail.status].includes("sent") && (
                  <Button
                    onClick={() => changeStatus(detail.id, "sent")}
                    disabled={statusBusy}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" /> Marcar enviado
                  </Button>
                )}
                {ALLOWED_TRANSITIONS[detail.status].includes("accepted") && (
                  <Button
                    onClick={() => changeStatus(detail.id, "accepted")}
                    disabled={statusBusy}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Aceptar
                  </Button>
                )}
                {ALLOWED_TRANSITIONS[detail.status].includes("rejected") && (
                  <Button
                    onClick={() => changeStatus(detail.id, "rejected")}
                    disabled={statusBusy}
                    variant="destructive"
                    className="gap-2"
                  >
                    <XCircle className="h-4 w-4" /> Rechazar
                  </Button>
                )}
              </>
            )}
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
  color: "blue" | "cyan" | "green" | "purple" | "orange";
}) {
  const palette: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500",
    cyan: "bg-cyan-500/10 text-cyan-500",
    green: "bg-green-500/10 text-green-500",
    purple: "bg-purple-500/10 text-purple-500",
    orange: "bg-orange-500/10 text-orange-500",
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
