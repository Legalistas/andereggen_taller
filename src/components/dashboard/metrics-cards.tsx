import { Card } from "@/components/ui/card"
import { Car, Wrench, Users, DollarSign } from "lucide-react"

const metrics = [
    {
        title: "Vehículos en Ruta",
        value: "42",
        change: "+18.2%",
        trend: "up",
        icon: Car,
        iconColor: "text-blue-500",
        bgColor: "bg-blue-50",
    },
    {
        title: "Vehículos con Errores",
        value: "8",
        change: "-8.7%",
        trend: "down",
        icon: Wrench,
        iconColor: "text-orange-500",
        bgColor: "bg-orange-50",
    },
    {
        title: "Desviados de Ruta",
        value: "27",
        change: "+4.3%",
        trend: "up",
        icon: DollarSign,
        iconColor: "text-pink-500",
        bgColor: "bg-pink-50",
    },
    {
        title: "Vehículos Retrasados",
        value: "13",
        change: "+2.5%",
        trend: "up",
        icon: Users,
        iconColor: "text-cyan-500",
        bgColor: "bg-cyan-50",
    },
]

export default function MetricsCards() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => {
                const Icon = metric.icon
                return (
                    <Card key={metric.title} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3">
                            <div className={`${metric.bgColor} p-2.5 rounded-lg shrink-0`}>
                                <Icon className={`h-5 w-5 ${metric.iconColor}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-3xl font-bold text-foreground mb-1 tabular-nums">{metric.value}</p>
                                <p className="text-sm text-muted-foreground mb-1.5">{metric.title}</p>
                                <div className="flex items-center gap-1">
                                    <span
                                        className={`text-xs font-semibold tabular-nums ${metric.trend === "up" ? "text-green-600" : "text-red-600"}`}
                                    >
                                        {metric.change}
                                    </span>
                                    <span className="text-xs text-muted-foreground">vs semana anterior</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                )
            })}
        </div>
    )
}
