"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

const revenueData = [
    { month: "Ene", ingresos: 38000, gastos: 22000 },
    { month: "Feb", ingresos: 42000, gastos: 25000 },
    { month: "Mar", ingresos: 35000, gastos: 21000 },
    { month: "Abr", ingresos: 48000, gastos: 28000 },
    { month: "May", ingresos: 52000, gastos: 30000 },
    { month: "Jun", ingresos: 45000, gastos: 26000 },
]

const servicesData = [
    { servicio: "Cambio de aceite", cantidad: 45 },
    { servicio: "Frenos", cantidad: 32 },
    { servicio: "Alineación", cantidad: 28 },
    { servicio: "Neumáticos", cantidad: 24 },
    { servicio: "Revisión general", cantidad: 18 },
]

const vehiclesData = [
    { dia: "Lun", vehiculos: 22 },
    { dia: "Mar", vehiculos: 28 },
    { dia: "Mié", vehiculos: 25 },
    { dia: "Jue", vehiculos: 31 },
    { dia: "Vie", vehiculos: 35 },
    { dia: "Sáb", vehiculos: 18 },
]

export default function ChartsSection() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4 hover:shadow-md transition-shadow">
                <CardHeader>
                    <CardTitle>Ingresos y Gastos</CardTitle>
                    <CardDescription>Comparación mensual del año actual</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-75 min-h-75 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData}>
                                <defs>
                                    <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#003b73" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#003b73" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "6px",
                                    }}
                                    labelStyle={{ color: "hsl(var(--foreground))" }}
                                />
                                <Area type="monotone" dataKey="ingresos" stroke="#003b73" fill="url(#colorIngresos)" strokeWidth={2} />
                                <Area
                                    type="monotone"
                                    dataKey="gastos"
                                    stroke="hsl(var(--accent))"
                                    fill="url(#colorGastos)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="lg:col-span-3 hover:shadow-md transition-shadow">
                <CardHeader>
                    <CardTitle>Servicios Más Solicitados</CardTitle>
                    <CardDescription>Últimos 30 días</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-75 min-h-75 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={servicesData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <YAxis
                                    dataKey="servicio"
                                    type="category"
                                    stroke="hsl(var(--muted-foreground))"
                                    width={120}
                                    fontSize={12}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "6px",
                                    }}
                                    labelStyle={{ color: "hsl(var(--foreground))" }}
                                />
                                <Bar dataKey="cantidad" fill="#003b73" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="lg:col-span-7 hover:shadow-md transition-shadow">
                <CardHeader>
                    <CardTitle>Flujo de Vehículos</CardTitle>
                    <CardDescription>Vehículos atendidos por día esta semana</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-50 min-h-50 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={vehiclesData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "6px",
                                    }}
                                    labelStyle={{ color: "hsl(var(--foreground))" }}
                                />
                                <Line type="monotone" dataKey="vehiculos" stroke="#003b73" strokeWidth={3} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
