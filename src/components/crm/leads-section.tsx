"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
    Car,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Edit,
    Eye,
    FileText,
    Info,
    Loader2,
    Mail,
    MoreVertical,
    Phone,
    Plus,
    Send,
    Trash2,
    TrendingUp,
    Trophy,
    XCircle,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import BudgetModal from "./budget-modal"
import CustomerSelector, { type Customer } from "./customer-selector"
import VehicleForm from "./vehicle-form"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

type LeadStatus = "solicitud" | "control" | "enviado" | "refuerzo" | "ganado" | "perdido"

type BudgetLite = {
    id: string
    number: number
    status: string
    grandTotal: string | number
    updatedAt: string
}

type Lead = {
    id: string
    status: LeadStatus
    notes: string | null
    source: string | null
    createdAt: string
    updatedAt: string
    customer: { id: string; name: string; email: string; phone: string }
    vehicle: { id: string; brand: string; model: string; year: string; domain: string } | null
    budgets: BudgetLite[]
}

type PeriodFilter = "all" | "7d" | "30d" | "90d"
type SortBy = "recent" | "oldest" | "amount_desc" | "name_asc"

const estadoConfig: Record<
    LeadStatus,
    { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: any; color: string }
> = {
    solicitud: { label: "Solicitud de presupuesto", variant: "default", icon: FileText, color: "text-blue-500" },
    control: { label: "Control de presupuesto", variant: "secondary", icon: ClipboardCheck, color: "text-purple-500" },
    enviado: { label: "Presupuesto enviado", variant: "outline", icon: Send, color: "text-cyan-500" },
    refuerzo: { label: "Refuerzo de venta", variant: "secondary", icon: TrendingUp, color: "text-orange-500" },
    ganado: { label: "Ganado", variant: "default", icon: Trophy, color: "text-green-500" },
    perdido: { label: "Perdido", variant: "destructive", icon: XCircle, color: "text-red-500" },
}

const ARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })

export default function LeadsSection() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)

    const [searchTerm, setSearchTerm] = useState("")
    const [selectedLeads, setSelectedLeads] = useState<string[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [activeTab, setActiveTab] = useState<"activas" | "cerradas">("activas")

    // Filtros
    const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all")
    const [sourceFilter, setSourceFilter] = useState<string>("all")
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all")
    const [sortBy, setSortBy] = useState<SortBy>("recent")

    // Estado del dialog "Nuevo Lead"
    const [showNewLeadDialog, setShowNewLeadDialog] = useState(false)
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [useExistingVehicle, setUseExistingVehicle] = useState<string | "new" | "">("")
    const [vehicleBrand, setVehicleBrand] = useState("")
    const [vehicleModel, setVehicleModel] = useState("")
    const [vehicleYear, setVehicleYear] = useState("")
    const [vehiclePlate, setVehiclePlate] = useState("")
    const [vehicleInsurance, setVehicleInsurance] = useState("")
    const [vehicleThirdPartyInsurance, setVehicleThirdPartyInsurance] = useState("")
    const [leadNotes, setLeadNotes] = useState("")
    const [creatingLead, setCreatingLead] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)

    // Estado del BudgetModal por fila
    const [budgetFor, setBudgetFor] = useState<string | null>(null)

    const activeStatuses: LeadStatus[] = ["solicitud", "control", "enviado", "refuerzo"]
    const closedStatuses: LeadStatus[] = ["ganado", "perdido"]

    const fetchLeads = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        setLoadError(null)
        try {
            const res = await fetch(`/api/crm/leads`, { signal })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = (await res.json()) as { leads: Lead[] }
            setLeads(data.leads)
        } catch (e) {
            if ((e as Error).name !== "AbortError") {
                setLoadError(e instanceof Error ? e.message : "Error al cargar leads")
            }
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        const ac = new AbortController()
        fetchLeads(ac.signal)
        return () => ac.abort()
    }, [fetchLeads])

    const tabFilteredLeads = useMemo(
        () =>
            leads.filter((lead) =>
                activeTab === "activas"
                    ? activeStatuses.includes(lead.status)
                    : closedStatuses.includes(lead.status),
            ),
        [leads, activeTab],
    )

    const filteredLeads = useMemo(() => {
        const t = searchTerm.toLowerCase()
        const now = Date.now()
        const periodMs: Record<PeriodFilter, number> = {
            all: Number.POSITIVE_INFINITY,
            "7d": 7 * 86400_000,
            "30d": 30 * 86400_000,
            "90d": 90 * 86400_000,
        }
        const cutoff = now - periodMs[periodFilter]

        const filtered = tabFilteredLeads.filter((lead) => {
            if (statusFilter !== "all" && lead.status !== statusFilter) return false
            if (sourceFilter !== "all" && (lead.source ?? "manual") !== sourceFilter) return false
            if (periodFilter !== "all" && new Date(lead.createdAt).getTime() < cutoff) return false
            if (t) {
                const matches =
                    lead.customer.name.toLowerCase().includes(t) ||
                    lead.customer.email.toLowerCase().includes(t) ||
                    (lead.vehicle && `${lead.vehicle.brand} ${lead.vehicle.model} ${lead.vehicle.domain}`.toLowerCase().includes(t))
                if (!matches) return false
            }
            return true
        })

        const amountOf = (l: Lead) => Number(l.budgets[0]?.grandTotal ?? 0)
        const sorted = [...filtered]
        sorted.sort((a, b) => {
            switch (sortBy) {
                case "oldest":
                    return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
                case "amount_desc":
                    return amountOf(b) - amountOf(a)
                case "name_asc":
                    return a.customer.name.localeCompare(b.customer.name, "es")
                case "recent":
                default:
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            }
        })
        return sorted
    }, [tabFilteredLeads, searchTerm, statusFilter, sourceFilter, periodFilter, sortBy])

    const activeFiltersCount =
        (statusFilter !== "all" ? 1 : 0) +
        (sourceFilter !== "all" ? 1 : 0) +
        (periodFilter !== "all" ? 1 : 0) +
        (searchTerm ? 1 : 0)

    const clearFilters = () => {
        setStatusFilter("all")
        setSourceFilter("all")
        setPeriodFilter("all")
        setSearchTerm("")
        setSortBy("recent")
    }

    const totalPages = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage))
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedLeads = filteredLeads.slice(startIndex, endIndex)

    const estadoCounts = useMemo(() => {
        const c: Record<LeadStatus, number> = {
            solicitud: 0, control: 0, enviado: 0, refuerzo: 0, ganado: 0, perdido: 0,
        }
        for (const l of leads) c[l.status]++
        return c
    }, [leads])

    const isAllSelected = paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedLeads.includes(l.id))
    const isSomeSelected = paginatedLeads.some((l) => selectedLeads.includes(l.id)) && !isAllSelected

    const toggleAllLeads = () => {
        if (isAllSelected) {
            setSelectedLeads(selectedLeads.filter((id) => !paginatedLeads.find((l) => l.id === id)))
        } else {
            const ids = paginatedLeads.map((l) => l.id)
            setSelectedLeads([...new Set([...selectedLeads, ...ids])])
        }
    }
    const toggleLead = (id: string) =>
        setSelectedLeads((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

    const handleItemsPerPageChange = (v: number) => { setItemsPerPage(v); setCurrentPage(1) }
    const handleTabChange = (t: "activas" | "cerradas") => {
        setActiveTab(t)
        setCurrentPage(1)
        setSelectedLeads([])
        setStatusFilter("all") // evitar estado inválido entre tabs
    }

    const resetNewLeadForm = () => {
        setSelectedCustomer(null)
        setUseExistingVehicle("")
        setVehicleBrand(""); setVehicleModel(""); setVehicleYear("")
        setVehiclePlate(""); setVehicleInsurance(""); setVehicleThirdPartyInsurance("")
        setLeadNotes("")
        setCreateError(null)
    }

    const handleCreateLead = async () => {
        setCreateError(null)
        if (!selectedCustomer) { setCreateError("Seleccioná un cliente."); return }

        const payload: Record<string, unknown> = {
            customerId: selectedCustomer.id,
            notes: leadNotes || null,
            source: "manual",
        }

        if (useExistingVehicle === "new") {
            if (!vehicleBrand || !vehicleModel || !vehicleYear || !vehiclePlate) {
                setCreateError("Completá marca, modelo, año y patente del vehículo.")
                return
            }
            payload.newVehicle = {
                brand: vehicleBrand,
                model: vehicleModel,
                year: vehicleYear,
                domain: vehiclePlate,
                secure: vehicleInsurance,
                thirdPartySecure: vehicleThirdPartyInsurance,
            }
        } else if (useExistingVehicle) {
            payload.vehicleId = useExistingVehicle
        }

        setCreatingLead(true)
        try {
            const res = await fetch("/api/crm/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({ error: "Error" }))
                throw new Error(body.error ?? `HTTP ${res.status}`)
            }
            resetNewLeadForm()
            setShowNewLeadDialog(false)
            await fetchLeads()
        } catch (e) {
            setCreateError(e instanceof Error ? e.message : "Error al crear lead")
        } finally {
            setCreatingLead(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <Breadcrumbs items={[{ label: "CRM" }, { label: "Leads" }]} />
                    <h1 className="text-3xl font-bold text-foreground">Leads</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gestiona tus clientes potenciales y oportunidades de negocio
                    </p>
                </div>
                <Dialog
                    open={showNewLeadDialog}
                    onOpenChange={(v) => { setShowNewLeadDialog(v); if (!v) resetNewLeadForm() }}
                >
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nuevo Lead
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Crear nuevo lead</DialogTitle>
                            <DialogDescription>
                                Seleccioná cliente y vehículo. El presupuesto lo cargás después desde la fila del lead.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-6 py-4">
                            <CustomerSelector
                                selectedCustomer={selectedCustomer}
                                onCustomerSelect={(c) => {
                                    setSelectedCustomer(c)
                                    setUseExistingVehicle(c?.vehicles?.[0]?.id ?? "new")
                                }}
                            />

                            {selectedCustomer && (
                                <div className="space-y-3">
                                    <Label>Vehículo</Label>
                                    <Select
                                        value={useExistingVehicle}
                                        onValueChange={(v) => setUseExistingVehicle(v as string)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar vehículo..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectedCustomer.vehicles?.map((v) => (
                                                <SelectItem key={v.id} value={v.id}>
                                                    {v.brand} {v.model} {v.year} — {v.domain}
                                                </SelectItem>
                                            ))}
                                            <SelectItem value="new">+ Vehículo nuevo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {useExistingVehicle === "new" && (
                                <VehicleForm
                                    brand={vehicleBrand}
                                    model={vehicleModel}
                                    year={vehicleYear}
                                    plate={vehiclePlate}
                                    insurance={vehicleInsurance}
                                    thirdPartyInsurance={vehicleThirdPartyInsurance}
                                    onBrandChange={setVehicleBrand}
                                    onModelChange={setVehicleModel}
                                    onYearChange={setVehicleYear}
                                    onPlateChange={setVehiclePlate}
                                    onInsuranceChange={setVehicleInsurance}
                                    onThirdPartyInsuranceChange={setVehicleThirdPartyInsurance}
                                />
                            )}

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Info className="h-4 w-4 text-primary" />
                                    </div>
                                    <h3 className="font-semibold">Información Adicional</h3>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="notes">Notas adicionales</Label>
                                    <Textarea
                                        id="notes"
                                        placeholder="Observaciones, detalles específicos..."
                                        rows={3}
                                        value={leadNotes}
                                        onChange={(e) => setLeadNotes(e.target.value)}
                                    />
                                </div>
                            </div>

                            {createError && (
                                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {createError}
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowNewLeadDialog(false)}
                                disabled={creatingLead}
                            >
                                Cancelar
                            </Button>
                            <Button onClick={handleCreateLead} disabled={creatingLead}>
                                {creatingLead ? "Creando..." : "Crear Lead"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b">
                <button
                    type="button"
                    onClick={() => handleTabChange("activas")}
                    className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === "activas" ? "text-[#003b73] border-b-2 border-[#003b73]" : "text-muted-foreground hover:text-foreground"}`}
                >
                    Oportunidades Activas
                    <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
                        {activeStatuses.reduce((a, s) => a + estadoCounts[s], 0)}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => handleTabChange("cerradas")}
                    className={`px-4 py-2 text-sm font-medium transition-colors relative ${activeTab === "cerradas" ? "text-[#003b73] border-b-2 border-[#003b73]" : "text-muted-foreground hover:text-foreground"}`}
                >
                    Oportunidades Cerradas
                    <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
                        {closedStatuses.reduce((a, s) => a + estadoCounts[s], 0)}
                    </span>
                </button>
            </div>

            {/* Stats Cards */}
            {activeTab === "activas" ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Solicitud" value={estadoCounts.solicitud} icon={FileText} color="blue" />
                    <StatCard label="Control" value={estadoCounts.control} icon={ClipboardCheck} color="purple" />
                    <StatCard label="Enviado" value={estadoCounts.enviado} icon={Send} color="cyan" />
                    <StatCard label="Refuerzo" value={estadoCounts.refuerzo} icon={TrendingUp} color="orange" />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Ganados" value={estadoCounts.ganado} icon={Trophy} color="green" />
                    <StatCard label="Perdidos" value={estadoCounts.perdido} icon={XCircle} color="red" />
                </div>
            )}

            {/* Filtros */}
            <Card className="p-4 space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <Input
                        placeholder="Buscar por nombre, email, patente o modelo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="md:max-w-md"
                    />
                    <div className="flex items-center gap-3">
                        {activeFiltersCount > 0 && (
                            <>
                                <span className="text-xs text-muted-foreground">
                                    {activeFiltersCount} filtro{activeFiltersCount > 1 ? "s" : ""} activo{activeFiltersCount > 1 ? "s" : ""}
                                </span>
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    Limpiar
                                </Button>
                            </>
                        )}
                        {selectedLeads.length > 0 && (
                            <span className="text-sm text-muted-foreground">
                                {selectedLeads.length} seleccionado{selectedLeads.length > 1 ? "s" : ""}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">Estado</Label>
                        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatus | "all")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los estados</SelectItem>
                                {(activeTab === "activas" ? activeStatuses : closedStatuses).map((s) => (
                                    <SelectItem key={s} value={s}>{estadoConfig[s].label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">Fuente</Label>
                        <Select value={sourceFilter} onValueChange={setSourceFilter}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las fuentes</SelectItem>
                                <SelectItem value="web">Web</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="manual">Manual</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">Período</Label>
                        <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las fechas</SelectItem>
                                <SelectItem value="7d">Últimos 7 días</SelectItem>
                                <SelectItem value="30d">Últimos 30 días</SelectItem>
                                <SelectItem value="90d">Últimos 90 días</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">Ordenar por</Label>
                        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="recent">Más recientes</SelectItem>
                                <SelectItem value="oldest">Más antiguos</SelectItem>
                                <SelectItem value="amount_desc">Mayor importe</SelectItem>
                                <SelectItem value="name_asc">Nombre (A–Z)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Card>

            {/* Leads Table */}
            <Card>
                {loadError && (
                    <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
                        {loadError}
                    </div>
                )}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={isAllSelected}
                                    onCheckedChange={toggleAllLeads}
                                    aria-label="Seleccionar todos"
                                    className={isSomeSelected ? "data-[state=checked]:bg-primary/50" : ""}
                                />
                            </TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Vehículo</TableHead>
                            <TableHead>Último presupuesto</TableHead>
                            <TableHead>Actualizado</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && paginatedLeads.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10">
                                    <Loader2 className="h-5 w-5 inline-block animate-spin mr-2" /> Cargando leads…
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && paginatedLeads.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">
                                    Sin leads para mostrar.
                                </TableCell>
                            </TableRow>
                        )}
                        {paginatedLeads.map((lead) => {
                            const StatusIcon = estadoConfig[lead.status].icon
                            const lastBudget = lead.budgets[0]
                            return (
                                <TableRow key={lead.id}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedLeads.includes(lead.id)}
                                            onCheckedChange={() => toggleLead(lead.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{lead.customer.name}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Phone className="h-3 w-3" /> {lead.customer.phone}
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Mail className="h-3 w-3" /> {lead.customer.email}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {lead.vehicle ? (
                                            <div className="flex items-center gap-2">
                                                <Car className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm">
                                                    {lead.vehicle.brand} {lead.vehicle.model} {lead.vehicle.year}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs italic text-muted-foreground">sin vehículo</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {lastBudget ? (
                                            <span className="font-medium">
                                                #{lastBudget.number} · {ARS.format(Number(lastBudget.grandTotal))}
                                            </span>
                                        ) : (
                                            <span className="text-xs italic text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {new Date(lead.updatedAt).toLocaleDateString("es-AR")}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={estadoConfig[lead.status].variant} className="gap-1">
                                            <StatusIcon className="h-3 w-3" />
                                            {estadoConfig[lead.status].label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-1"
                                                onClick={() => setBudgetFor(lead.id)}
                                            >
                                                <FileText className="h-4 w-4" />
                                                Presupuesto
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem className="gap-2">
                                                        <Eye className="h-4 w-4" /> Ver detalles
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2">
                                                        <Edit className="h-4 w-4" /> Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2 text-destructive">
                                                        <Trash2 className="h-4 w-4" /> Eliminar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t px-4 py-4">
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                            Mostrando {filteredLeads.length === 0 ? 0 : startIndex + 1} a{" "}
                            {Math.min(endIndex, filteredLeads.length)} de {filteredLeads.length} leads
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Mostrar</span>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 gap-1 bg-transparent">
                                        {itemsPerPage}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    <DropdownMenuItem onClick={() => handleItemsPerPageChange(10)}>10</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleItemsPerPageChange(25)}>25</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleItemsPerPageChange(50)}>50</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <span className="text-sm text-muted-foreground">por página</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" /> Anterior
                        </Button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <Button
                                    key={page}
                                    variant={currentPage === page ? "default" : "outline"}
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </Button>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                            disabled={currentPage === totalPages}
                        >
                            Siguiente <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Budget modal (controlado) */}
            <BudgetModal
                leadId={budgetFor ?? undefined}
                hideTrigger
                open={budgetFor !== null}
                onOpenChange={(v) => { if (!v) setBudgetFor(null) }}
                onSaved={() => { setBudgetFor(null); fetchLeads() }}
            />
        </div>
    )
}

function StatCard({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string
    value: number
    icon: any
    color: "blue" | "purple" | "cyan" | "orange" | "green" | "red"
}) {
    const palette: Record<string, string> = {
        blue: "bg-blue-500/10 text-blue-500",
        purple: "bg-purple-500/10 text-purple-500",
        cyan: "bg-cyan-500/10 text-cyan-500",
        orange: "bg-orange-500/10 text-orange-500",
        green: "bg-green-500/10 text-green-500",
        red: "bg-red-500/10 text-red-500",
    }
    return (
        <Card className="p-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${palette[color]}`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </Card>
    )
}
