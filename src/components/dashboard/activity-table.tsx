import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Car, Clock, CheckCircle2, AlertCircle } from "lucide-react"

const activities = [
    {
        vehicle: "Toyota Corolla 2020",
        plate: "ABC-123",
        service: "Cambio de aceite + filtros",
        mechanic: "Carlos Ruiz",
        status: "completed",
        time: "Hace 15 min",
    },
    {
        vehicle: "Honda Civic 2019",
        plate: "XYZ-789",
        service: "Revisión de frenos",
        mechanic: "María González",
        status: "in-progress",
        time: "Hace 30 min",
    },
    {
        vehicle: "Ford Escape 2021",
        plate: "DEF-456",
        service: "Alineación y balanceo",
        mechanic: "Juan Pérez",
        status: "completed",
        time: "Hace 1 hora",
    },
    {
        vehicle: "Nissan Sentra 2018",
        plate: "GHI-321",
        service: "Cambio de neumáticos",
        mechanic: "Pedro López",
        status: "pending",
        time: "Hace 1.5 horas",
    },
    {
        vehicle: "Mazda CX-5 2022",
        plate: "JKL-654",
        service: "Mantenimiento general",
        mechanic: "Ana Martínez",
        status: "completed",
        time: "Hace 2 horas",
    },
]

export default function ActivityTable() {
    return (
        <Card className="hover:shadow-md transition-shadow py-0">
            <CardHeader>
                <CardTitle>Actividad Reciente</CardTitle>
                <CardDescription>Últimos servicios realizados hoy</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {activities.map((activity, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between py-4 px-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div
                                    className={`h-12 w-12 rounded-lg flex items-center justify-center ${activity.status === "completed"
                                            ? "bg-accent/10"
                                            : activity.status === "in-progress"
                                                ? "bg-primary/10"
                                                : "bg-muted"
                                        }`}
                                >
                                    <Car
                                        className={`h-6 w-6 ${activity.status === "completed"
                                                ? "text-accent"
                                                : activity.status === "in-progress"
                                                    ? "text-primary"
                                                    : "text-muted-foreground"
                                            }`}
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-foreground">{activity.vehicle}</p>
                                        <Badge variant="outline" className="text-xs">
                                            {activity.plate}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">{activity.service}</p>
                                    <p className="text-xs text-muted-foreground mt-1">Mecánico: {activity.mechanic}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Badge
                                    variant={activity.status === "completed" ? "default" : "secondary"}
                                    className={`gap-1 ${activity.status === "completed"
                                            ? "bg-accent text-accent-foreground"
                                            : activity.status === "in-progress"
                                                ? "bg-primary text-primary-foreground"
                                                : ""
                                        }`}
                                >
                                    {activity.status === "completed" ? (
                                        <>
                                            <CheckCircle2 className="h-3 w-3" />
                                            Completado
                                        </>
                                    ) : activity.status === "in-progress" ? (
                                        <>
                                            <Clock className="h-3 w-3" />
                                            En proceso
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="h-3 w-3" />
                                            Pendiente
                                        </>
                                    )}
                                </Badge>
                                <span className="text-sm text-muted-foreground min-w-25 text-right">{activity.time}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
