"use client"

import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    AlertTriangle,
    Bell,
    Calendar,
    Car,
    CheckCircle2,
    Clock,
    FileText,
    Loader2,
    RefreshCw,
    Send,
    SendHorizontal,
    Trophy,
    Users,
    XCircle,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

type Reminder = {
    id: string
    number: number
    customerName: string
    customerEmail: string
    vehicleBrand: string
    vehicleModel: string
    vehicleDomain: string
    grandTotal: string | number
    validityDays: number
    sentAt: string | null
    leadId: string
}

type ReinforcementLead = {
    id: string
    status: string
    notes: string | null
    updatedAt: string
    customer: { id: string; name: string; email: string; phone: string }
    vehicle: { id: string; brand: string; model: string; domain: string } | null
    budgets: Array<{ id: string; number: number; grandTotal: string | number; sentAt: string | null; status: string }>
}

type ExpiringBudget = Reminder & { expiresAt: string }

type LeadWithoutBudget = {
    id: string
    createdAt: string
    notes: string | null
    customer: { id: string; name: string; email: string; phone: string }
    vehicle: { id: string; brand: string; model: string; domain: string } | null
}

type DraftPending = {
    id: string
    number: number
    customerName: string
    vehicleBrand: string
    vehicleModel: string
    vehicleDomain: string
    grandTotal: string | number
    createdAt: string
    leadId: string
}

type FollowupsResponse = {
    thresholds: {
        reminderDaysAfterSent: number
        expiringWithinDays: number
        idleDaysThreshold: number
    }
    remindersNeeded: Reminder[]
    inReinforcement: ReinforcementLead[]
    expiringSoon: ExpiringBudget[]
    leadsWithoutBudget: LeadWithoutBudget[]
    draftsPending: DraftPending[]
    totalActions: number
}

const ARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })

function daysSince(iso: string | null): number {
    if (!iso) return 0
    return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400_000))
}

function daysUntil(iso: string): number {
    return Math.round((new Date(iso).getTime() - Date.now()) / 86400_000)
}

export default function FollowupsSection() {
    const [data, setData] = useState<FollowupsResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const res = await fetch("/api/crm/followups")
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            setData((await res.json()) as FollowupsResponse)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // ── Acciones ─────────────────────────────────────────────
    const sendReminder = async (leadId: string, budgetNumber: number) => {
        setBusyId(leadId)
        try {
            const res = await fetch(`/api/crm/leads/${leadId}/reminder`, { method: "POST" })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
            const parts = [`Presupuesto #${budgetNumber}: lead pasado a refuerzo.`]
            if (body.notifyEnabled === false) {
                parts.push("Las notificaciones automáticas están desactivadas — no se envió email.")
            } else if (body.emailSent) {
                parts.push("Email de recordatorio enviado.")
            } else {
                parts.push("No se pudo enviar el email (ver consola).")
            }
            alert(parts.join(" "))
            await fetchData()
        } catch (e) {
            alert(e instanceof Error ? e.message : "Error")
        } finally {
            setBusyId(null)
        }
    }

    const changeBudgetStatus = async (budgetId: string, status: "accepted" | "rejected" | "expired") => {
        setBusyId(budgetId)
        try {
            const res = await fetch(`/api/budgets/${budgetId}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
            if (body.stockWarnings?.length > 0) {
                alert("Aceptado con alertas de stock:\n\n" + body.stockWarnings.join("\n"))
            }
            await fetchData()
        } catch (e) {
            alert(e instanceof Error ? e.message : "Error")
        } finally {
            setBusyId(null)
        }
    }

    const markLeadLost = async (leadId: string) => {
        setBusyId(leadId)
        try {
            const res = await fetch(`/api/crm/leads/${leadId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "perdido" }),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            await fetchData()
        } catch (e) {
            alert(e instanceof Error ? e.message : "Error")
        } finally {
            setBusyId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <Breadcrumbs items={[{ label: "CRM" }, { label: "Seguimiento" }]} />
                <h1 className="text-3xl font-bold">Seguimiento</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Bandeja de acciones pendientes del embudo. Entrá acá para saber qué hay que contactar, recordar o cerrar.
                </p>
            </div>

            <Card className="p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        {data && (
                            <Badge
                                variant="outline"
                                className={`gap-1.5 ${data.totalActions === 0 ? "bg-green-500/10 text-green-700 border-green-200" : "bg-orange-500/10 text-orange-700 border-orange-200"}`}
                            >
                                {data.totalActions === 0 ? (
                                    <><CheckCircle2 className="h-3 w-3" /> Todo al día</>
                                ) : (
                                    <><AlertTriangle className="h-3 w-3" /> {data.totalActions} {data.totalActions === 1 ? "acción" : "acciones"} pendiente{data.totalActions === 1 ? "" : "s"}</>
                                )}
                            </Badge>
                        )}
                        {data && (
                            <span className="text-xs text-muted-foreground hidden md:inline">
                                Umbral recordatorio: {data.thresholds.reminderDaysAfterSent} días · vencimiento próximo ≤{data.thresholds.expiringWithinDays} días · lead inactivo &gt;{data.thresholds.idleDaysThreshold} días
                            </span>
                        )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={fetchData} className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Recargar
                    </Button>
                </div>
            </Card>

            {error && (
                <Card className="p-6 border-destructive/40 bg-destructive/5">
                    <p className="text-sm text-destructive">{error}</p>
                </Card>
            )}

            {loading && !data && (
                <Card className="p-10 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 inline animate-spin mr-2" /> Buscando acciones pendientes…
                </Card>
            )}

            {data && data.totalActions === 0 && (
                <Card className="p-12 text-center">
                    <Trophy className="h-12 w-12 mx-auto text-green-500 mb-3" />
                    <h2 className="text-lg font-semibold">No hay acciones pendientes</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Todos los presupuestos están al día y los leads tienen respuesta. Buen trabajo.
                    </p>
                </Card>
            )}

            {data && data.totalActions > 0 && (
                <div className="space-y-4">
                    {/* 1. Recordatorios pendientes */}
                    {data.remindersNeeded.length > 0 && (
                        <BucketCard
                            icon={Bell}
                            title="Recordatorios pendientes"
                            desc={`Presupuestos enviados hace más de ${data.thresholds.reminderDaysAfterSent} días sin respuesta.`}
                            count={data.remindersNeeded.length}
                            color="orange"
                        >
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Vehículo</TableHead>
                                        <TableHead>Enviado hace</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.remindersNeeded.map((b) => (
                                        <TableRow key={b.id}>
                                            <TableCell className="font-mono text-sm">#{b.number}</TableCell>
                                            <TableCell>
                                                <div className="font-medium text-sm">{b.customerName}</div>
                                                <div className="text-xs text-muted-foreground">{b.customerEmail}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Car className="h-3 w-3 text-muted-foreground" />
                                                    {b.vehicleBrand} {b.vehicleModel}
                                                </div>
                                                <div className="text-xs font-mono text-muted-foreground">{b.vehicleDomain}</div>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                <Clock className="h-3 w-3 inline mr-1 text-muted-foreground" />
                                                {daysSince(b.sentAt)} días
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{ARS.format(Number(b.grandTotal))}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-1"
                                                    onClick={() => sendReminder(b.leadId, b.number)}
                                                    disabled={busyId === b.leadId}
                                                >
                                                    {busyId === b.leadId ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                                                    Enviar recordatorio
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </BucketCard>
                    )}

                    {/* 2. En refuerzo */}
                    {data.inReinforcement.length > 0 && (
                        <BucketCard
                            icon={Send}
                            title="En refuerzo"
                            desc="Ya se envió el recordatorio. Esperando respuesta del cliente — cerrálo cuando tengas noticias."
                            count={data.inReinforcement.length}
                            color="purple"
                        >
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Vehículo</TableHead>
                                        <TableHead>Último presupuesto</TableHead>
                                        <TableHead>Reforzado hace</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.inReinforcement.map((lead) => {
                                        const last = lead.budgets[0]
                                        return (
                                            <TableRow key={lead.id}>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{lead.customer.name}</div>
                                                    <div className="text-xs text-muted-foreground">{lead.customer.phone}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {lead.vehicle ? (
                                                        <div className="flex items-center gap-1 text-sm">
                                                            <Car className="h-3 w-3 text-muted-foreground" />
                                                            {lead.vehicle.brand} {lead.vehicle.model} <span className="font-mono text-xs text-muted-foreground">· {lead.vehicle.domain}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs italic text-muted-foreground">sin vehículo</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {last ? (
                                                        <span className="text-sm font-medium">
                                                            #{last.number} · {ARS.format(Number(last.grandTotal))}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs italic text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {daysSince(lead.updatedAt)} días
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {last && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="gap-1 text-green-700 border-green-300"
                                                                onClick={() => changeBudgetStatus(last.id, "accepted")}
                                                                disabled={busyId === last.id}
                                                            >
                                                                <CheckCircle2 className="h-4 w-4" /> Ganado
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-1 text-destructive"
                                                            onClick={() => markLeadLost(lead.id)}
                                                            disabled={busyId === lead.id}
                                                        >
                                                            <XCircle className="h-4 w-4" /> Perdido
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </BucketCard>
                    )}

                    {/* 3. Por vencer */}
                    {data.expiringSoon.length > 0 && (
                        <BucketCard
                            icon={Clock}
                            title="Presupuestos por vencer"
                            desc={`Vencen en los próximos ${data.thresholds.expiringWithinDays} días (o ya vencidos).`}
                            count={data.expiringSoon.length}
                            color="red"
                        >
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Vehículo</TableHead>
                                        <TableHead>Vence</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.expiringSoon.map((b) => {
                                        const days = daysUntil(b.expiresAt)
                                        return (
                                            <TableRow key={b.id}>
                                                <TableCell className="font-mono text-sm">#{b.number}</TableCell>
                                                <TableCell className="font-medium text-sm">{b.customerName}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <Car className="h-3 w-3 text-muted-foreground" />
                                                        {b.vehicleBrand} {b.vehicleModel}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <Calendar className="h-3 w-3 inline mr-1" />
                                                    {days < 0 ? (
                                                        <span className="text-destructive font-medium">vencido hace {Math.abs(days)} días</span>
                                                    ) : days === 0 ? (
                                                        <span className="text-destructive font-medium">hoy</span>
                                                    ) : (
                                                        <span className="text-orange-600">en {days} días</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">{ARS.format(Number(b.grandTotal))}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="gap-1"
                                                        onClick={() => changeBudgetStatus(b.id, "expired")}
                                                        disabled={busyId === b.id}
                                                    >
                                                        {busyId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                                        Marcar vencido
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </BucketCard>
                    )}

                    {/* 4. Leads sin presupuesto */}
                    {data.leadsWithoutBudget.length > 0 && (
                        <BucketCard
                            icon={Users}
                            title="Leads sin presupuesto"
                            desc={`Leads creados hace más de ${data.thresholds.idleDaysThreshold} días que todavía no tienen cotización.`}
                            count={data.leadsWithoutBudget.length}
                            color="blue"
                        >
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Vehículo</TableHead>
                                        <TableHead>Creado hace</TableHead>
                                        <TableHead>Notas</TableHead>
                                        <TableHead className="text-right">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.leadsWithoutBudget.map((lead) => (
                                        <TableRow key={lead.id}>
                                            <TableCell>
                                                <div className="font-medium text-sm">{lead.customer.name}</div>
                                                <div className="text-xs text-muted-foreground">{lead.customer.phone}</div>
                                            </TableCell>
                                            <TableCell>
                                                {lead.vehicle ? (
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <Car className="h-3 w-3 text-muted-foreground" />
                                                        {lead.vehicle.brand} {lead.vehicle.model}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs italic text-muted-foreground">sin vehículo</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs">{daysSince(lead.createdAt)} días</TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                                                {lead.notes ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button asChild size="sm" variant="outline" className="gap-1">
                                                    <Link href="/crm/cotizaciones">
                                                        <FileText className="h-4 w-4" /> Crear cotización
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </BucketCard>
                    )}

                    {/* 5. Borradores pendientes */}
                    {data.draftsPending.length > 0 && (
                        <BucketCard
                            icon={FileText}
                            title="Borradores pendientes de envío"
                            desc="Presupuestos en borrador creados hace más de 2 días. Si están listos, marcalos como enviados."
                            count={data.draftsPending.length}
                            color="slate"
                        >
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Vehículo</TableHead>
                                        <TableHead>Creado hace</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.draftsPending.map((b) => (
                                        <TableRow key={b.id}>
                                            <TableCell className="font-mono text-sm">#{b.number}</TableCell>
                                            <TableCell className="font-medium text-sm">{b.customerName}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Car className="h-3 w-3 text-muted-foreground" />
                                                    {b.vehicleBrand} {b.vehicleModel}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs">{daysSince(b.createdAt)} días</TableCell>
                                            <TableCell className="text-right font-medium">{ARS.format(Number(b.grandTotal))}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-1"
                                                    onClick={async () => {
                                                        setBusyId(b.id)
                                                        try {
                                                            const res = await fetch(`/api/budgets/${b.id}/status`, {
                                                                method: "POST",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({ status: "sent" }),
                                                            })
                                                            if (!res.ok) {
                                                                const body = await res.json().catch(() => ({}))
                                                                alert(body?.error ?? `HTTP ${res.status}`)
                                                                return
                                                            }
                                                            await fetchData()
                                                        } finally {
                                                            setBusyId(null)
                                                        }
                                                    }}
                                                    disabled={busyId === b.id}
                                                >
                                                    {busyId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                    Marcar enviado
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </BucketCard>
                    )}
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────

function BucketCard({
    icon: Icon,
    title,
    desc,
    count,
    color,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>
    title: string
    desc: string
    count: number
    color: "orange" | "purple" | "red" | "blue" | "slate"
    children: React.ReactNode
}) {
    const palette: Record<string, { icon: string; badge: string }> = {
        orange: { icon: "bg-orange-500/10 text-orange-600", badge: "bg-orange-500/10 text-orange-700 border-orange-200" },
        purple: { icon: "bg-purple-500/10 text-purple-600", badge: "bg-purple-500/10 text-purple-700 border-purple-200" },
        red: { icon: "bg-red-500/10 text-red-600", badge: "bg-red-500/10 text-red-700 border-red-200" },
        blue: { icon: "bg-blue-500/10 text-blue-600", badge: "bg-blue-500/10 text-blue-700 border-blue-200" },
        slate: { icon: "bg-slate-500/10 text-slate-600", badge: "bg-slate-500/10 text-slate-700 border-slate-200" },
    }
    return (
        <Card className="overflow-hidden">
            <div className="flex items-start gap-3 p-4 border-b">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${palette[color].icon}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{title}</h3>
                        <Badge variant="outline" className={palette[color].badge}>{count}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
            </div>
            <div className="overflow-x-auto">{children}</div>
        </Card>
    )
}
