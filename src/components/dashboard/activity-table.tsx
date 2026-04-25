import { AlertCircle, Car, CheckCircle2, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ActivityStatus = "completed" | "in-progress" | "pending";

const activities: Array<{
  vehicle: string;
  plate: string;
  service: string;
  mechanic: string;
  status: ActivityStatus;
  time: string;
}> = [
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
];

const STATUS_STYLES: Record<
  ActivityStatus,
  { icon: typeof CheckCircle2; label: string; badge: string; iconBg: string; iconFg: string }
> = {
  completed: {
    icon: CheckCircle2,
    label: "Completado",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconBg: "bg-emerald-50",
    iconFg: "text-emerald-600",
  },
  "in-progress": {
    icon: Clock,
    label: "En proceso",
    badge: "bg-[#003b73]/10 text-[#003b73] border-[#003b73]/20",
    iconBg: "bg-[#003b73]/10",
    iconFg: "text-[#003b73]",
  },
  pending: {
    icon: AlertCircle,
    label: "Pendiente",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    iconBg: "bg-amber-50",
    iconFg: "text-amber-600",
  },
};

export default function ActivityTable() {
  return (
    <Card className="py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-4 py-5 border-b border-slate-100">
        <div>
          <CardTitle className="text-base">Actividad reciente</CardTitle>
          <CardDescription>Últimos servicios del día</CardDescription>
        </div>
        <Link
          href="/produccion"
          className="text-xs font-medium text-[#003b73] hover:underline inline-flex items-center gap-1 shrink-0"
        >
          Ver todo
          <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-slate-100">
          {activities.map((activity) => {
            const style = STATUS_STYLES[activity.status];
            const StatusIcon = style.icon;
            return (
              <li
                key={`${activity.vehicle}-${activity.plate}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
              >
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${style.iconBg}`}
                >
                  <Car className={`h-5 w-5 ${style.iconFg}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {activity.vehicle}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono tracking-wide px-1.5 py-0 h-5 bg-slate-50 text-slate-600 border-slate-200"
                    >
                      {activity.plate}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {activity.service} · {activity.mechanic}
                  </p>
                </div>

                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                  <Badge
                    variant="outline"
                    className={`gap-1 font-medium ${style.badge}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {style.label}
                  </Badge>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {activity.time}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
