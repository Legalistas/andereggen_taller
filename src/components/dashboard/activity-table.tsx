"use client";

import {
  AlertCircle,
  Car,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ActivityStatus = "completed" | "in-progress" | "pending";

type Activity = {
  id: string;
  vehicle: string;
  plate: string;
  service: string;
  mechanic: string;
  status: ActivityStatus;
  statusLabel: string;
  time: string;
};

const STATUS_STYLES: Record<
  ActivityStatus,
  { icon: typeof CheckCircle2; badge: string; iconBg: string; iconFg: string }
> = {
  completed: {
    icon: CheckCircle2,
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconBg: "bg-emerald-50",
    iconFg: "text-emerald-600",
  },
  "in-progress": {
    icon: Clock,
    badge: "bg-[#003b73]/10 text-[#003b73] border-[#003b73]/20",
    iconBg: "bg-[#003b73]/10",
    iconFg: "text-[#003b73]",
  },
  pending: {
    icon: AlertCircle,
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    iconBg: "bg-amber-50",
    iconFg: "text-amber-600",
  },
};

export default function ActivityTable() {
  const [items, setItems] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/dashboard/activity", { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { items: Activity[] };
      })
      .then((d) => setItems(d.items))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Error");
        }
      });
    return () => ac.abort();
  }, []);

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-4 py-5 border-b border-slate-100">
        <div>
          <CardTitle className="text-base">Actividad reciente</CardTitle>
          <CardDescription>Últimas reparaciones actualizadas</CardDescription>
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
        {error && (
          <div className="px-5 py-6 text-sm text-rose-700 bg-rose-50">
            No se pudo cargar la actividad: {error}
          </div>
        )}
        {!error && items === null && (
          <div className="px-5 py-12 flex items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {!error && items !== null && items.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-slate-400 italic">
            Todavía no hay reparaciones registradas
          </div>
        )}
        {!error && items !== null && items.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {items.map((activity) => {
              const style = STATUS_STYLES[activity.status];
              const StatusIcon = style.icon;
              return (
                <li
                  key={activity.id}
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
                      {activity.statusLabel}
                    </Badge>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {activity.time}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
