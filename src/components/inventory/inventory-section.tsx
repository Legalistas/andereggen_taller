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
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { CATEGORY_BY_KEY, MOVEMENT_LABEL, PART_CATEGORIES } from "@/lib/parts-catalog"
import {
    AlertCircle,
    AlertTriangle,
    ArrowDownToLine,
    ArrowUpFromLine,
    Calendar,
    CheckCircle2,
    Edit,
    Eye,
    History,
    Loader2,
    MoreVertical,
    Package,
    PackageX,
    Plus,
    RefreshCw,
    Ruler,
    Trash2,
    TrendingDown,
    Wrench,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { PartCategory, PartMovementType } from "../../../generated/prisma/client"

type Part = {
    id: string
    sku: string | null
    name: string
    description: string | null
    brand: string | null
    appliesTo: string | null
    category: PartCategory
    costPrice: string | number
    salePrice: string | number
    stockQty: string | number
    stockMin: string | number
    isActive: boolean
    createdAt: string
    updatedAt: string
}

type Movement = {
    id: string
    type: PartMovementType
    qty: string | number
    reason: string
    note: string | null
    createdAt: string
    budget: { id: string; number: number } | null
    createdBy: { id: string; name: string | null; email: string | null } | null
}

const ARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
const INT = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 })

export default function InventorySection() {
    const [parts, setParts] = useState<Part[]>([])
    const [loading, setLoading] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)

    const [search, setSearch] = useState("")
    const [filterCategory, setFilterCategory] = useState<PartCategory | "all">("all")
    const [lowStockOnly, setLowStockOnly] = useState(false)
    const [activeOnly, setActiveOnly] = useState(false)

    // Dialogs
    const [formOpen, setFormOpen] = useState(false)
    const [formPart, setFormPart] = useState<Part | null>(null) // null = creación
    const [form, setForm] = useState({
        sku: "",
        name: "",
        description: "",
        brand: "",
        appliesTo: "",
        category: "OTROS" as PartCategory,
        costPrice: "",
        salePrice: "",
        stockQty: "",
        stockMin: "",
        isActive: true,
    })
    const [formBusy, setFormBusy] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    const [stockPart, setStockPart] = useState<Part | null>(null)
    const [stockType, setStockType] = useState<PartMovementType>("IN")
    const [stockQty, setStockQty] = useState("")
    const [stockReason, setStockReason] = useState("")
    const [stockNote, setStockNote] = useState("")
    const [stockBusy, setStockBusy] = useState(false)
    const [stockError, setStockError] = useState<string | null>(null)

    const [historyPart, setHistoryPart] = useState<Part | null>(null)
    const [historyMovements, setHistoryMovements] = useState<Movement[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)

    const [deletePart, setDeletePart] = useState<Part | null>(null)
    const [deleteBusy, setDeleteBusy] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    // ── Fetch ────────────────────────────────────────────────────
    const fetchParts = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        setLoadError(null)
        try {
            const params = new URLSearchParams()
            if (search) params.set("search", search)
            if (filterCategory !== "all") params.set("category", filterCategory)
            if (lowStockOnly) params.set("lowStock", "1")
            if (activeOnly) params.set("active", "1")
            const res = await fetch(`/api/parts?${params}`, { signal })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = (await res.json()) as { parts: Part[] }
            setParts(data.parts)
        } catch (e) {
            if ((e as Error).name !== "AbortError") {
                setLoadError(e instanceof Error ? e.message : "Error al cargar repuestos")
            }
        } finally {
            setLoading(false)
        }
    }, [search, filterCategory, lowStockOnly, activeOnly])

    useEffect(() => {
        const ac = new AbortController()
        const t = setTimeout(() => fetchParts(ac.signal), 200)
        return () => {
            ac.abort()
            clearTimeout(t)
        }
    }, [fetchParts])

    // ── Stats ────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const active = parts.filter((p) => p.isActive)
        const low = parts.filter((p) => Number(p.stockQty) <= Number(p.stockMin))
        const outOfStock = parts.filter((p) => Number(p.stockQty) <= 0)
        const stockValue = parts.reduce(
            (acc, p) => acc + Number(p.stockQty) * Number(p.costPrice),
            0,
        )
        return {
            total: parts.length,
            active: active.length,
            lowStock: low.length,
            outOfStock: outOfStock.length,
            stockValue,
        }
    }, [parts])

    // ── Handlers ─────────────────────────────────────────────────
    const openCreate = () => {
        setFormPart(null)
        setForm({
            sku: "", name: "", description: "", brand: "", appliesTo: "",
            category: "OTROS", costPrice: "", salePrice: "", stockQty: "", stockMin: "", isActive: true,
        })
        setFormError(null)
        setFormOpen(true)
    }

    const openEdit = (p: Part) => {
        setFormPart(p)
        setForm({
            sku: p.sku ?? "",
            name: p.name,
            description: p.description ?? "",
            brand: p.brand ?? "",
            appliesTo: p.appliesTo ?? "",
            category: p.category,
            costPrice: String(p.costPrice),
            salePrice: String(p.salePrice),
            stockQty: String(p.stockQty),
            stockMin: String(p.stockMin),
            isActive: p.isActive,
        })
        setFormError(null)
        setFormOpen(true)
    }

    const submitForm = async () => {
        if (!form.name.trim()) {
            setFormError("El nombre es obligatorio")
            return
        }
        setFormBusy(true)
        setFormError(null)
        try {
            const payload = {
                sku: form.sku || null,
                name: form.name.trim(),
                description: form.description || null,
                brand: form.brand || null,
                appliesTo: form.appliesTo || null,
                category: form.category,
                costPrice: Number(form.costPrice || 0),
                salePrice: Number(form.salePrice || 0),
                stockMin: Number(form.stockMin || 0),
                isActive: form.isActive,
                ...(formPart === null && { stockQty: Number(form.stockQty || 0) }),
            }
            const res = formPart
                ? await fetch(`/api/parts/${formPart.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                })
                : await fetch("/api/parts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)

            // Si estamos creando y puso stockQty inicial > 0, generamos un movimiento IN
            if (!formPart && Number(form.stockQty) > 0 && body.part) {
                await fetch(`/api/parts/${body.part.id}/movements`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "IN",
                        qty: Number(form.stockQty),
                        reason: "Stock inicial",
                    }),
                })
            }
            setFormOpen(false)
            await fetchParts()
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "Error al guardar")
        } finally {
            setFormBusy(false)
        }
    }

    const openStock = (p: Part, type: PartMovementType = "IN") => {
        setStockPart(p)
        setStockType(type)
        setStockQty("")
        setStockReason("")
        setStockNote("")
        setStockError(null)
    }

    const submitStock = async () => {
        if (!stockPart) return
        if (!stockReason.trim()) {
            setStockError("El motivo es obligatorio")
            return
        }
        if (Number(stockQty) < 0) {
            setStockError("Cantidad inválida")
            return
        }
        setStockBusy(true)
        setStockError(null)
        try {
            const res = await fetch(`/api/parts/${stockPart.id}/movements`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: stockType,
                    qty: Number(stockQty || 0),
                    reason: stockReason.trim(),
                    note: stockNote || null,
                }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
            setStockPart(null)
            await fetchParts()
        } catch (e) {
            setStockError(e instanceof Error ? e.message : "Error")
        } finally {
            setStockBusy(false)
        }
    }

    const openHistory = async (p: Part) => {
        setHistoryPart(p)
        setHistoryMovements([])
        setHistoryLoading(true)
        try {
            const res = await fetch(`/api/parts/${p.id}/movements`)
            const body = await res.json()
            setHistoryMovements(body.movements ?? [])
        } finally {
            setHistoryLoading(false)
        }
    }

    const submitDelete = async () => {
        if (!deletePart) return
        setDeleteBusy(true)
        setDeleteError(null)
        try {
            const res = await fetch(`/api/parts/${deletePart.id}`, { method: "DELETE" })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
            setDeletePart(null)
            await fetchParts()
        } catch (e) {
            setDeleteError(e instanceof Error ? e.message : "Error")
        } finally {
            setDeleteBusy(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <Breadcrumbs items={[{ label: "Inventario" }, { label: "Repuestos" }]} />
                    <h1 className="text-3xl font-bold">Inventario de repuestos</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Catálogo + stock + historial de movimientos. Los presupuestos aceptados descuentan automáticamente.
                    </p>
                </div>
                <Button className="gap-2" onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    Nuevo repuesto
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard label="Total" value={String(stats.total)} icon={Package} color="blue" />
                <StatCard label="Activos" value={String(stats.active)} icon={CheckCircle2} color="green" />
                <StatCard label="Bajo stock" value={String(stats.lowStock)} icon={TrendingDown} color="orange" />
                <StatCard label="Sin stock" value={String(stats.outOfStock)} icon={PackageX} color="red" />
                <StatCard
                    label="Valor inmovilizado"
                    value={ARS.format(stats.stockValue)}
                    icon={Ruler}
                    color="purple"
                />
            </div>

            {/* Filtros */}
            <Card className="p-4 space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <Input
                        placeholder="Buscar por nombre, SKU, marca o modelo..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="md:max-w-md"
                    />
                    <Button variant="ghost" size="sm" onClick={() => fetchParts()} className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Recargar
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="grid gap-1.5">
                        <Label className="text-xs text-muted-foreground">Categoría</Label>
                        <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as PartCategory | "all")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las categorías</SelectItem>
                                {PART_CATEGORIES.map((c) => (
                                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end gap-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                                checked={lowStockOnly}
                                onCheckedChange={(c) => setLowStockOnly(Boolean(c))}
                            />
                            Solo bajo stock
                        </label>
                    </div>
                    <div className="flex items-end gap-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                                checked={activeOnly}
                                onCheckedChange={(c) => setActiveOnly(Boolean(c))}
                            />
                            Solo activos
                        </label>
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
                            <TableHead>Repuesto</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead className="text-right">Precio venta</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && parts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10">
                                    <Loader2 className="h-5 w-5 inline animate-spin mr-2" /> Cargando…
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && parts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                                    Sin repuestos para mostrar.
                                </TableCell>
                            </TableRow>
                        )}
                        {parts.map((p) => {
                            const qty = Number(p.stockQty)
                            const min = Number(p.stockMin)
                            const isLow = qty <= min
                            const isOut = qty <= 0
                            const catStyle = CATEGORY_BY_KEY[p.category]
                            return (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div className="flex items-start gap-2">
                                            <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                                <Wrench className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-medium">{p.name}</div>
                                                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2">
                                                    {p.sku && <span className="font-mono">{p.sku}</span>}
                                                    {p.brand && <span>· {p.brand}</span>}
                                                </div>
                                                {p.appliesTo && (
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        Aplica: {p.appliesTo}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`${catStyle.color}`}>{catStyle.label}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {ARS.format(Number(p.salePrice))}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className={`font-semibold ${isOut ? "text-destructive" : isLow ? "text-orange-600" : ""}`}>
                                                {INT.format(qty)}
                                            </span>
                                            <span className="text-xs text-muted-foreground">/ min {INT.format(min)}</span>
                                            {isOut ? (
                                                <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-200 gap-1">
                                                    <PackageX className="h-3 w-3" /> Sin stock
                                                </Badge>
                                            ) : isLow ? (
                                                <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-200 gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> Bajo
                                                </Badge>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {p.isActive ? (
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
                                            <Button variant="outline" size="sm" className="gap-1" onClick={() => openStock(p, "IN")}>
                                                <ArrowDownToLine className="h-4 w-4" /> Stock
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem className="gap-2" onClick={() => openHistory(p)}>
                                                        <History className="h-4 w-4" /> Ver historial
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2" onClick={() => openStock(p, "IN")}>
                                                        <ArrowDownToLine className="h-4 w-4 text-green-600" /> Entrada
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2" onClick={() => openStock(p, "OUT")}>
                                                        <ArrowUpFromLine className="h-4 w-4 text-red-600" /> Salida
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2" onClick={() => openStock(p, "ADJUST")}>
                                                        <Ruler className="h-4 w-4 text-blue-600" /> Ajustar (valor exacto)
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2" onClick={() => openEdit(p)}>
                                                        <Edit className="h-4 w-4" /> Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2 text-destructive" onClick={() => { setDeletePart(p); setDeleteError(null) }}>
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
            </Card>

            {/* Dialog: Nueva / Editar parte */}
            <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setFormError(null) }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {formPart ? <Edit className="h-5 w-5 text-[#003b73]" /> : <Plus className="h-5 w-5 text-[#003b73]" />}
                            {formPart ? "Editar repuesto" : "Nuevo repuesto"}
                        </DialogTitle>
                        <DialogDescription>
                            {formPart ? "Actualizá los datos del repuesto. El stock se modifica desde entradas/salidas."
                                : "Creá un nuevo repuesto. Si indicás stock inicial, se registra automáticamente como entrada (IN)."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label htmlFor="sku">SKU</Label>
                                <Input id="sku" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="CRST-LUNETA-COR" />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="brand">Marca</Label>
                                <Input id="brand" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="AGC, Bosch..." />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="name">Nombre *</Label>
                            <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Luneta térmica Toyota Corolla" />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="appliesTo">Aplica a</Label>
                            <Input id="appliesTo" value={form.appliesTo} onChange={(e) => setForm((f) => ({ ...f, appliesTo: e.target.value }))} placeholder="Toyota Corolla 2014–2020" />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Categoría</Label>
                            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as PartCategory }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {PART_CATEGORIES.map((c) => (
                                        <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                                <Label htmlFor="costPrice">Precio costo</Label>
                                <Input id="costPrice" type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="salePrice">Precio venta</Label>
                                <Input id="salePrice" type="number" min="0" step="0.01" value={form.salePrice} onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {!formPart && (
                                <div className="grid gap-1.5">
                                    <Label htmlFor="stockQty">Stock inicial</Label>
                                    <Input id="stockQty" type="number" min="0" step="0.01" value={form.stockQty} onChange={(e) => setForm((f) => ({ ...f, stockQty: e.target.value }))} />
                                </div>
                            )}
                            <div className="grid gap-1.5">
                                <Label htmlFor="stockMin">Stock mínimo (alerta)</Label>
                                <Input id="stockMin" type="number" min="0" step="0.01" value={form.stockMin} onChange={(e) => setForm((f) => ({ ...f, stockMin: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="description">Descripción</Label>
                            <Textarea id="description" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox checked={form.isActive} onCheckedChange={(c) => setForm((f) => ({ ...f, isActive: Boolean(c) }))} />
                            Activo (disponible para presupuestos)
                        </label>
                        {formError && (
                            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{formError}</span>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormOpen(false)} disabled={formBusy}>Cancelar</Button>
                        <Button onClick={submitForm} disabled={formBusy} className="gap-2">
                            {formBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : "Guardar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Ajustar stock */}
            <Dialog open={!!stockPart} onOpenChange={(v) => { if (!v) setStockPart(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {stockType === "IN" && <ArrowDownToLine className="h-5 w-5 text-green-600" />}
                            {stockType === "OUT" && <ArrowUpFromLine className="h-5 w-5 text-red-600" />}
                            {stockType === "ADJUST" && <Ruler className="h-5 w-5 text-blue-600" />}
                            {stockType === "IN" ? "Entrada de stock" : stockType === "OUT" ? "Salida de stock" : "Ajustar stock (valor exacto)"}
                        </DialogTitle>
                        <DialogDescription>
                            {stockPart && (
                                <>
                                    <b>{stockPart.name}</b> · stock actual: {INT.format(Number(stockPart.stockQty))}
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-1.5">
                            <Label>Tipo</Label>
                            <Select value={stockType} onValueChange={(v) => setStockType(v as PartMovementType)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="IN">Entrada (+)</SelectItem>
                                    <SelectItem value="OUT">Salida (−)</SelectItem>
                                    <SelectItem value="ADJUST">Ajuste (reemplaza)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="stockQty">{stockType === "ADJUST" ? "Stock final" : "Cantidad"}</Label>
                            <Input id="stockQty" type="number" min="0" step="0.01" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="stockReason">Motivo *</Label>
                            <Input id="stockReason" value={stockReason} onChange={(e) => setStockReason(e.target.value)} placeholder={stockType === "IN" ? "Compra a proveedor" : stockType === "OUT" ? "Uso interno del taller" : "Corrección de inventario"} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="stockNote">Nota (opcional)</Label>
                            <Textarea id="stockNote" rows={2} value={stockNote} onChange={(e) => setStockNote(e.target.value)} />
                        </div>
                        {stockError && (
                            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{stockError}</span>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setStockPart(null)} disabled={stockBusy}>Cancelar</Button>
                        <Button onClick={submitStock} disabled={stockBusy} className="gap-2">
                            {stockBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Aplicando…</> : "Aplicar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Historial de movimientos */}
            <Dialog open={!!historyPart} onOpenChange={(v) => { if (!v) setHistoryPart(null) }}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-[#003b73]" />
                            Historial · {historyPart?.name}
                        </DialogTitle>
                        <DialogDescription>Movimientos recientes (últimos 100).</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        {historyLoading ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Cargando historial…
                            </div>
                        ) : historyMovements.length === 0 ? (
                            <div className="py-10 text-center text-sm text-muted-foreground italic">
                                Sin movimientos registrados todavía.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead className="text-right">Cantidad</TableHead>
                                        <TableHead>Motivo</TableHead>
                                        <TableHead>Presupuesto</TableHead>
                                        <TableHead>Por</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {historyMovements.map((m) => {
                                        const ml = MOVEMENT_LABEL[m.type]
                                        return (
                                            <TableRow key={m.id}>
                                                <TableCell className="text-xs">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                                        {new Date(m.createdAt).toLocaleString("es-AR")}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={ml.color}>{ml.label}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {m.type === "OUT" ? "−" : m.type === "IN" ? "+" : "="} {INT.format(Number(m.qty))}
                                                </TableCell>
                                                <TableCell className="text-sm">{m.reason}</TableCell>
                                                <TableCell className="text-sm">
                                                    {m.budget ? (
                                                        <span className="font-mono text-xs">#{m.budget.number}</span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {m.createdBy?.name ?? m.createdBy?.email ?? "—"}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setHistoryPart(null)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Eliminar */}
            <Dialog open={!!deletePart} onOpenChange={(v) => { if (!v) setDeletePart(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Eliminar repuesto
                        </DialogTitle>
                        <DialogDescription>
                            Acción permanente. Si el repuesto tiene movimientos o está usado en presupuestos,
                            la DB va a rechazar la eliminación — en ese caso, desactivalo en su lugar.
                        </DialogDescription>
                    </DialogHeader>
                    {deletePart && (
                        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                            <div className="font-medium">{deletePart.name}</div>
                            {deletePart.sku && <div className="text-xs font-mono text-muted-foreground">{deletePart.sku}</div>}
                        </div>
                    )}
                    {deleteError && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{deleteError}</span>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletePart(null)} disabled={deleteBusy}>Cancelar</Button>
                        <Button variant="destructive" onClick={submitDelete} disabled={deleteBusy} className="gap-2">
                            {deleteBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Eliminando…</> : <><Trash2 className="h-4 w-4" /> Eliminar</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// StatCard reusable (mismo pattern que en leads)
function StatCard({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string
    value: string
    icon: React.ComponentType<{ className?: string }>
    color: "blue" | "green" | "orange" | "red" | "purple"
}) {
    const palette: Record<string, string> = {
        blue: "bg-blue-500/10 text-blue-500",
        green: "bg-green-500/10 text-green-500",
        orange: "bg-orange-500/10 text-orange-500",
        red: "bg-red-500/10 text-red-500",
        purple: "bg-purple-500/10 text-purple-500",
    }
    return (
        <Card className="p-4">
            <div className="flex items-center justify-between">
                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold truncate">{value}</p>
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${palette[color]}`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </Card>
    )
}
