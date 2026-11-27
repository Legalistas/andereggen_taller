"use client";

import { AlertTriangle, Loader2, Plus, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ALERT_DAYS, type FleetAlert, fmtDate } from "@/lib/fleet";
import {
  api,
  type FleetVehicleBase,
  FormDialog,
  StatusBadge,
  TransferBadge,
  VEHICLE_FIELDS,
  vehicleValues,
} from "./fleet-ui";

type ListData = { vehicles: FleetVehicleBase[]; alerts: FleetAlert[] };

export default function FleetList() {
  const router = useRouter();
  const [data, setData] = useState<ListData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api<ListData>("/api/flota/vehicles")
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const alertCount = new Map<string, number>();
  for (const a of data?.alerts ?? [])
    alertCount.set(a.vehicleId, (alertCount.get(a.vehicleId) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Flota</h1>
          <p className="text-sm text-slate-500">
            Vehículos del taller: papeles, seguro, patente, VTV, service y
            reparaciones.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nuevo vehículo
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && data.alerts.length > 0 && (
        <Card className="p-4 space-y-2 border-amber-200">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Vencimientos de los próximos {ALERT_DAYS} días
          </h2>
          <ul className="divide-y">
            {data.alerts.map((a) => (
              <li key={`${a.vehicleId}-${a.label}-${a.date}`}>
                <Link
                  href={`/flota/${a.vehicleId}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm hover:bg-muted/50 rounded-md px-2 -mx-2"
                >
                  <StatusBadge status={a.overdue ? "VENCIDO" : "POR_VENCER"} />
                  <span className="tabular-nums text-muted-foreground">
                    {fmtDate(a.date)}
                  </span>
                  <span className="font-mono font-medium">{a.plate}</span>
                  <span>{a.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data && data.vehicles.length === 0 && (
        <Card className="p-10 text-center space-y-2">
          <Truck className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Todavía no hay vehículos cargados.
          </p>
        </Card>
      )}

      {data && data.vehicles.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patente</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>Transferencia</TableHead>
                <TableHead>Documentación física</TableHead>
                <TableHead className="text-right">Avisos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.vehicles.map((v) => (
                <TableRow
                  key={v.id}
                  className={`cursor-pointer ${v.isActive ? "" : "opacity-60"}`}
                  onClick={() => router.push(`/flota/${v.id}`)}
                >
                  <TableCell>
                    <Link
                      href={`/flota/${v.id}`}
                      className="font-mono font-semibold hover:underline"
                    >
                      {v.plate}
                    </Link>
                    {!v.isActive && (
                      <Badge variant="outline" className="ml-2">
                        Baja
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {[v.brand, v.model, v.year].filter(Boolean).join(" ") ||
                      "—"}
                  </TableCell>
                  <TableCell>{v.ownerName ?? "—"}</TableCell>
                  <TableCell>
                    <TransferBadge transferred={v.transferred} />
                  </TableCell>
                  <TableCell className="max-w-64 truncate">
                    {v.documentsLocation ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {alertCount.get(v.id) ? (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                        {alertCount.get(v.id)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {creating && (
        <FormDialog
          title="Nuevo vehículo"
          fields={VEHICLE_FIELDS}
          initial={vehicleValues()}
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const { vehicle } = await api<{ vehicle: { id: string } }>(
              "/api/flota/vehicles",
              "POST",
              values,
            );
            router.push(`/flota/${vehicle.id}`);
          }}
        />
      )}
    </div>
  );
}
