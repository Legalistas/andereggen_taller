"use client"

import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Activity,
    BarChart3,
    Calendar,
    ClipboardCheck,
    FileText,
    Loader2,
    Package,
    PiggyBank,
    RefreshCw,
    Send,
    TrendingUp,
    Trophy,
    Users,
    XCircle,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

type StatsResponse = {
    period: { from: string; to: string }
    kpis: {
        totalBudgets: number
        conversionRate: number
        pipeline: number
        invoiced: number
        activeLeads: number
        avgTicket: number
    }
    leadFunnel: Record<string, number>
    budgetStatus: Record<string, { count: number; amount: number }>
    monthlySeries: Array<{ month: string; label: string; emitted: number; accepted: number; acceptedAmount: number }>
    topCustomers: Array<{ email: string; name: string; count: number; amount: number }>
    topParts: Array<{ id: string; name: string; sku: string | null; qtyOut: number; movements: number; salePrice: number }>
    leadSources: Array<{ key: string; count: number }>
}

const ARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })
const INT = new Intl.NumberFormat("es-AR")

const LEAD_STATUS_LABELS: Record<string, string> = {
    solicitud: "Solicitud",
    control: "Control",
    enviado: "Enviado",
    refuerzo: "Refuerzo",
    ganado: "Ganado",
    perdido: "Perdido",
}

const LEAD_STATUS_COLORS: Record<string, string> = {
    solicitud: "#3b82f6",  // blue
    control: "#a855f7",    // purple
    enviado: "#06b6d4",    // cyan
    refuerzo: "#f97316",   // orange
    ganado: "#22c55e",     // green
    perdido: "#ef4444",    // red
}

const BUDGET_STATUS_LABELS: Record<string, string> = {
    draft: "Borrador",
    sent: "Enviado",
    accepted: "Aceptado",
    rejected: "Rechazado",
    expired: "Vencido",
}

const BUDGET_STATUS_COLORS: Record<string, string> = {
    draft: "#94a3b8",
    sent: "#06b6d4",
    accepted: "#22c55e",
    rejected: "#ef4444",
    expired: "#71717a",
}

export default function StatsSection() {
    const [data, setData] = useState<StatsResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [period, setPeriod] = useState<"30d" | "90d" | "6m" | "12m">("6m")

    const fetchStats = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const days = period === "30d" ? 30 : period === "90d" ? 90 : period === "6m" ? 180 : 365
            const from = new Date(Date.now() - days * 86400_000)
            const res = await fetch(`/api/stats?dateFrom=${from.toISOString()}&dateTo=${new Date().toISOString()}`)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const body = (await res.json()) as StatsResponse
            setData(body)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error")
        } finally {
            setLoading(false)
        }
    }, [period])

    useEffect(() => { fetchStats() }, [fetchStats])

    // Datos derivados para gráficos
    const leadFunnelData = useMemo(() => {
        if (!data) return []
        return (["solicitud", "control", "enviado", "refuerzo", "ganado", "perdido"] as const).map((k) => ({
            name: LEAD_STATUS_LABELS[k],
            value: data.leadFunnel[k] ?? 0,
            color: LEAD_STATUS_COLORS[k],
        }))
    }, [data])

    const budgetStatusData = useMemo(() => {
        if (!data) return []
        return Object.entries(data.budgetStatus).map(([k, v]) => ({
            name: BUDGET_STATUS_LABELS[k],
            value: v.count,
            amount: v.amount,
            color: BUDGET_STATUS_COLORS[k],
        })).filter((d) => d.value > 0)
    }, [data])

    const sourceData = useMemo(() => {
        if (!data) return []
        return data.leadSources.map((s) => ({ name: s.key, value: s.count }))
    }, [data])

    return (
        <div className="space-y-6">
            <div>
                <Breadcrumbs items={[{ label: "Estadísticas" }]} />
                <h1 className="text-3xl font-bold">Estadísticas</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Métricas del CRM, presupuestos, inventario y conversión para toma de decisiones.
                </p>
            </div>

            {/* Filtro */}
            <Card className="p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Label className="text-xs text-muted-foreground">Período</Label>
                        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="30d">Últimos 30 días</SelectItem>
                                <SelectItem value="90d">Últimos 90 días</SelectItem>
                                <SelectItem value="6m">Últimos 6 meses</SelectItem>
                                <SelectItem value="12m">Último año</SelectItem>
                            </SelectContent>
                        </Select>
                        {data?.period && (
                            <span className="text-xs text-muted-foreground hidden md:inline">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                {new Date(data.period.from).toLocaleDateString("es-AR")}
                                {" → "}
                                {new Date(data.period.to).toLocaleDateString("es-AR")}
                            </span>
                        )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={fetchStats} className="gap-2">
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
                    <Loader2 className="h-5 w-5 inline animate-spin mr-2" /> Calculando métricas…
                </Card>
            )}

            {data && (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <KpiCard label="Presupuestos" value={INT.format(data.kpis.totalBudgets)} icon={FileText} color="blue" />
                        <KpiCard label="Conversión" value={`${data.kpis.conversionRate}%`} icon={TrendingUp} color="purple" />
                        <KpiCard label="Pipeline" value={ARS.format(data.kpis.pipeline)} icon={Send} color="cyan" />
                        <KpiCard label="Facturado" value={ARS.format(data.kpis.invoiced)} icon={PiggyBank} color="green" />
                        <KpiCard label="Leads activos" value={INT.format(data.kpis.activeLeads)} icon={Activity} color="orange" />
                        <KpiCard label="Ticket promedio" value={ARS.format(data.kpis.avgTicket)} icon={Trophy} color="indigo" />
                    </div>

                    {/* Gráficos: serie mensual + embudo */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="p-5 lg:col-span-2">
                            <ChartHeader title="Facturación mensual" subtitle="Presupuestos aceptados por mes" icon={BarChart3} />
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={data.monthlySeries}>
                                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                        <YAxis
                                            tick={{ fontSize: 11 }}
                                            tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(v))}
                                        />
                                        <Tooltip
                                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                            formatter={(v, name) => (name === "Monto facturado" ? ARS.format(Number(v)) : INT.format(Number(v)))}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                        <Line type="monotone" dataKey="acceptedAmount" name="Monto facturado" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                                        <Line type="monotone" dataKey="emitted" name="Emitidos" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} yAxisId="right" hide />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        <Card className="p-5">
                            <ChartHeader title="Embudo CRM" subtitle="Leads por estado en el período" icon={ClipboardCheck} />
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={leadFunnelData} layout="vertical" margin={{ left: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 11 }} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            {leadFunnelData.map((e) => <Cell key={e.name} fill={e.color} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>

                    {/* Distribución de presupuestos + fuentes */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card className="p-5">
                            <ChartHeader title="Distribución de presupuestos" subtitle="Por estado — cantidades y montos" icon={FileText} />
                            {budgetStatusData.length === 0 ? (
                                <EmptyMini text="Sin presupuestos en el período" />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-center">
                                    <div className="h-52">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={budgetStatusData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
                                                    {budgetStatusData.map((e) => <Cell key={e.name} fill={e.color} />)}
                                                </Pie>
                                                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="space-y-1.5">
                                        {budgetStatusData.map((d) => (
                                            <div key={d.name} className="flex items-center gap-2 text-sm">
                                                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                                                <span className="flex-1">{d.name}</span>
                                                <span className="font-mono text-xs text-muted-foreground">{d.value}</span>
                                                <span className="font-mono text-xs min-w-[90px] text-right">{ARS.format(d.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>

                        <Card className="p-5">
                            <ChartHeader title="Fuentes de lead" subtitle="De dónde llegan los clientes" icon={Users} />
                            {sourceData.length === 0 ? (
                                <EmptyMini text="Sin datos de fuente" />
                            ) : (
                                <div className="h-52">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={sourceData}>
                                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                                            <YAxis tick={{ fontSize: 11 }} />
                                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                            <Bar dataKey="value" fill="#003b73" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Rankings */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card className="p-5">
                            <ChartHeader title="Top clientes" subtitle="Por monto facturado (presupuestos aceptados)" icon={Trophy} />
                            {data.topCustomers.length === 0 ? (
                                <EmptyMini text="Sin clientes con presupuestos aceptados" />
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead className="text-right w-16">N°</TableHead>
                                            <TableHead className="text-right">Facturado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.topCustomers.map((c, i) => (
                                            <TableRow key={c.email}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-xs w-6 h-6 p-0 flex items-center justify-center font-mono">{i + 1}</Badge>
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-sm truncate">{c.name}</div>
                                                            <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-sm">{c.count}</TableCell>
                                                <TableCell className="text-right font-medium">{ARS.format(c.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </Card>

                        <Card className="p-5">
                            <ChartHeader title="Repuestos más consumidos" subtitle="Unidades salidas (OUT) del inventario" icon={Package} />
                            {data.topParts.length === 0 ? (
                                <EmptyMini text="Sin movimientos de salida" />
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Repuesto</TableHead>
                                            <TableHead className="text-right w-20">Unidades</TableHead>
                                            <TableHead className="text-right w-24">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.topParts.map((p, i) => (
                                            <TableRow key={p.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-xs w-6 h-6 p-0 flex items-center justify-center font-mono">{i + 1}</Badge>
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-sm truncate">{p.name}</div>
                                                            {p.sku && <div className="text-xs font-mono text-muted-foreground truncate">{p.sku}</div>}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-sm font-medium">{INT.format(p.qtyOut)}</TableCell>
                                                <TableCell className="text-right text-xs text-muted-foreground">
                                                    {ARS.format(p.qtyOut * p.salePrice)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </Card>
                    </div>
                </>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────

function KpiCard({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string
    value: string
    icon: React.ComponentType<{ className?: string }>
    color: "blue" | "cyan" | "green" | "purple" | "orange" | "indigo"
}) {
    const palette: Record<string, string> = {
        blue: "bg-blue-500/10 text-blue-500",
        cyan: "bg-cyan-500/10 text-cyan-500",
        green: "bg-green-500/10 text-green-500",
        purple: "bg-purple-500/10 text-purple-500",
        orange: "bg-orange-500/10 text-orange-500",
        indigo: "bg-indigo-500/10 text-indigo-500",
    }
    return (
        <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
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

function ChartHeader({
    title,
    subtitle,
    icon: Icon,
}: {
    title: string
    subtitle: string
    icon: React.ComponentType<{ className?: string }>
}) {
    return (
        <div className="flex items-start gap-2 pb-3 mb-3 border-b">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
                <h3 className="font-semibold text-sm">{title}</h3>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
        </div>
    )
}

function EmptyMini({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <XCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground italic">{text}</p>
        </div>
    )
}
