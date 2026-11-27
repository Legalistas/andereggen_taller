"use client";

import {
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addMonths,
  arToday,
  day,
  dueStatus,
  fmtDate,
  MAINTENANCE_LABEL,
  OBLIGATION_LABEL,
  PERIOD_OPTIONS,
} from "@/lib/fleet";
import type {
  FleetMaintenanceKind,
  FleetObligationType,
} from "../../../generated/prisma/client";
import {
  ARS,
  api,
  FileChips,
  type FleetFileRow,
  type FleetVehicleBase,
  FormDialog,
  type FormField,
  type FormValues,
  StatusBadge,
  TransferBadge,
  VEHICLE_FIELDS,
  vehicleValues,
} from "./fleet-ui";

type Payment = {
  id: string;
  dueDate: string;
  amount: string | null;
  paidAt: string | null;
  notes: string | null;
  files: FleetFileRow[];
};

type Obligation = {
  id: string;
  type: FleetObligationType;
  provider: string | null;
  reference: string | null;
  holderName: string | null;
  autoDebit: boolean;
  debitAccount: string | null;
  periodMonths: number | null;
  validUntil: string | null;
  notes: string | null;
  payments: Payment[];
};

type Maintenance = {
  id: string;
  kind: FleetMaintenanceKind;
  date: string;
  mileage: number | null;
  description: string;
  provider: string | null;
  cost: string | null;
  nextDate: string | null;
  nextMileage: number | null;
  files: FleetFileRow[];
};

type Vehicle = FleetVehicleBase & {
  obligations: Obligation[];
  maintenance: Maintenance[];
  files: FleetFileRow[];
};

type DialogState = {
  title: string;
  fields: FormField[];
  initial: FormValues;
  submit: (v: FormValues) => Promise<unknown>;
};

const OBLIGATION_FIELDS: FormField[] = [
  {
    key: "type",
    label: "Tipo *",
    type: "select",
    options: Object.entries(OBLIGATION_LABEL).map(([value, label]) => ({
      value,
      label,
    })),
  },
  {
    key: "provider",
    label: "Compañía / entidad",
    placeholder: "Ej: La Segunda, Municipalidad",
  },
  { key: "reference", label: "Nº de póliza / partida" },
  { key: "holderName", label: "A nombre de quién está" },
  {
    key: "autoDebit",
    label: "Se paga por débito automático",
    type: "checkbox",
  },
  {
    key: "debitAccount",
    label: "Cuenta o tarjeta donde se debita",
    show: (v) => v.autoDebit === true,
  },
  {
    key: "periodMonths",
    label: "Cada cuánto se paga",
    type: "select",
    options: [
      { value: "", label: "Sin periodicidad fija" },
      ...PERIOD_OPTIONS.map((p) => ({
        value: String(p.months),
        label: p.label,
      })),
    ],
  },
  { key: "validUntil", label: "Vigente hasta (póliza / VTV)", type: "date" },
  { key: "notes", label: "Notas", type: "textarea" },
];

const PAYMENT_FIELDS: FormField[] = [
  { key: "dueDate", label: "Vence / se debita el *", type: "date" },
  { key: "amount", label: "Monto", type: "number" },
  { key: "paidAt", label: "Pagado el (vacío = pendiente)", type: "date" },
  { key: "notes", label: "Notas", wide: true },
];

const MAINTENANCE_FIELDS: FormField[] = [
  {
    key: "kind",
    label: "Tipo *",
    type: "select",
    options: Object.entries(MAINTENANCE_LABEL).map(([value, label]) => ({
      value,
      label,
    })),
  },
  { key: "date", label: "Fecha *", type: "date" },
  {
    key: "description",
    label: "Qué se hizo / qué repuesto *",
    type: "textarea",
  },
  { key: "provider", label: "Taller o proveedor" },
  { key: "mileage", label: "Kilometraje", type: "number" },
  { key: "cost", label: "Costo", type: "number" },
  {
    key: "nextDate",
    label: "Próximo service (fecha)",
    type: "date",
    show: (v) => v.kind === "SERVICE",
  },
  {
    key: "nextMileage",
    label: "Próximo service (km)",
    type: "number",
    show: (v) => v.kind === "SERVICE",
  },
];

const str = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);
const dateStr = (v: string | null) => (v ? day(v) : "");

export default function FleetVehicleDetail({ id }: { id: string }) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [paperName, setPaperName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const today = arToday();

  const load = useCallback(() => {
    api<{ vehicle: Vehicle }>(`/api/flota/vehicles/${id}`)
      .then((d) => setVehicle(d.vehicle))
      .catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  /** Acción con confirmación opcional; recarga la ficha al terminar. */
  const run = async (fn: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setActionError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error");
    }
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!vehicle)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  const v = vehicle;

  const openObligation = (o?: Obligation) =>
    setDialog({
      title: o ? "Editar gestión" : "Nueva gestión (seguro, patente, VTV…)",
      fields: OBLIGATION_FIELDS,
      initial: {
        type: o?.type ?? "SEGURO",
        provider: str(o?.provider),
        reference: str(o?.reference),
        holderName: str(o?.holderName ?? (o ? "" : v.ownerName)),
        autoDebit: o?.autoDebit ?? false,
        debitAccount: str(o?.debitAccount),
        periodMonths: str(o?.periodMonths),
        validUntil: dateStr(o?.validUntil ?? null),
        notes: str(o?.notes),
      },
      submit: (vals) =>
        o
          ? api(`/api/flota/obligations/${o.id}`, "PATCH", vals)
          : api(`/api/flota/vehicles/${v.id}/obligations`, "POST", vals),
    });

  const openPayment = (o: Obligation, p?: Payment) => {
    // Pago nuevo: propone la fecha siguiente según la periodicidad y el último monto.
    const last = o.payments[0];
    const nextDue =
      last && o.periodMonths
        ? addMonths(day(last.dueDate), o.periodMonths)
        : "";
    setDialog({
      title: `${p ? "Editar pago" : "Nuevo pago"} · ${OBLIGATION_LABEL[o.type]}`,
      fields: PAYMENT_FIELDS,
      initial: p
        ? {
            dueDate: dateStr(p.dueDate),
            amount: str(p.amount),
            paidAt: dateStr(p.paidAt),
            notes: str(p.notes),
          }
        : {
            dueDate: nextDue,
            amount: str(last?.amount),
            paidAt: "",
            notes: "",
          },
      submit: (vals) =>
        p
          ? api(`/api/flota/payments/${p.id}`, "PATCH", vals)
          : api(`/api/flota/obligations/${o.id}/payments`, "POST", vals),
    });
  };

  const openMaintenance = (m?: Maintenance) =>
    setDialog({
      title: m ? "Editar trabajo" : "Nuevo service / reparación / repuesto",
      fields: MAINTENANCE_FIELDS,
      initial: {
        kind: m?.kind ?? "SERVICE",
        date: m ? dateStr(m.date) : today,
        description: str(m?.description),
        provider: str(m?.provider),
        mileage: str(m?.mileage),
        cost: str(m?.cost),
        nextDate: dateStr(m?.nextDate ?? null),
        nextMileage: str(m?.nextMileage),
      },
      submit: (vals) =>
        m
          ? api(`/api/flota/maintenance/${m.id}`, "PATCH", vals)
          : api(`/api/flota/vehicles/${v.id}/maintenance`, "POST", vals),
    });

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[{ label: "Flota", href: "/flota" }, { label: v.plate }]}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold font-mono text-slate-900">
            {v.plate}
            {!v.isActive && <Badge variant="outline">Baja</Badge>}
          </h1>
          <p className="text-sm text-slate-500">
            {[v.brand, v.model, v.year, v.color].filter(Boolean).join(" · ") ||
              "Sin datos del modelo"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              setDialog({
                title: "Editar vehículo",
                fields: VEHICLE_FIELDS,
                initial: vehicleValues(v),
                submit: (vals) =>
                  api(`/api/flota/vehicles/${v.id}`, "PATCH", vals),
              })
            }
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="ghost"
            className="text-destructive"
            aria-label="Eliminar vehículo"
            onClick={() =>
              run(async () => {
                await api(`/api/flota/vehicles/${v.id}`, "DELETE");
                router.push("/flota");
              }, `¿Eliminar ${v.plate} con todos sus pagos, trabajos y archivos? Si se vendió, mejor editalo y desmarcá "Activo".`)
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {/* Papeles */}
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold">Papeles</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Titular (a nombre de)">{v.ownerName ?? "—"}</Info>
          <Info label="Transferencia">
            <TransferBadge transferred={v.transferred} />
          </Info>
          <Info label="Documentación física">{v.documentsLocation ?? "—"}</Info>
          <Info label="Nº de chasis">{v.chassisNumber ?? "—"}</Info>
          <Info label="Nº de motor">{v.engineNumber ?? "—"}</Info>
          {v.notes && <Info label="Notas">{v.notes}</Info>}
        </dl>
        <div className="space-y-2 border-t pt-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Documentos escaneados
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={paperName}
              onChange={(e) => setPaperName(e.target.value)}
              placeholder="Qué es (Título, Cédula verde…) — opcional"
              className="h-8 max-w-72 text-sm"
              aria-label="Nombre del documento a subir"
            />
            <FileChips
              files={v.files}
              target={{ vehicleId: v.id }}
              uploadLabel="Subir papel"
              name={paperName}
              onChange={() => {
                setPaperName("");
                load();
              }}
            />
          </div>
        </div>
      </Card>

      {/* Gestiones: seguro, patente, VTV… */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Seguro, patente, VTV y otros</h2>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => openObligation()}
          >
            <Plus className="h-4 w-4" />
            Agregar gestión
          </Button>
        </div>
        {v.obligations.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Cargá el seguro, la patente y la VTV para controlar cuándo vence y
            se paga cada uno.
          </p>
        )}
        {v.obligations.map((o) => {
          const validity = o.validUntil
            ? dueStatus(o.validUntil, null, today)
            : null;
          const period = PERIOD_OPTIONS.find(
            (p) => p.months === o.periodMonths,
          );
          return (
            <div key={o.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {OBLIGATION_LABEL[o.type]}
                    {o.provider && (
                      <span className="font-normal">· {o.provider}</span>
                    )}
                    {o.reference && (
                      <span className="text-xs font-normal text-muted-foreground">
                        Nº {o.reference}
                      </span>
                    )}
                    {(validity === "VENCIDO" || validity === "POR_VENCER") && (
                      <StatusBadge status={validity} />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[
                      o.holderName && `A nombre de ${o.holderName}`,
                      o.autoDebit
                        ? `Débito automático${o.debitAccount ? ` en ${o.debitAccount}` : ""}`
                        : "Pago manual",
                      period?.label,
                      o.validUntil && `Vigente hasta ${fmtDate(o.validUntil)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {o.notes && <p className="text-xs">{o.notes}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1"
                    onClick={() => openPayment(o)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Pago
                  </Button>
                  <IconButton
                    label="Editar gestión"
                    onClick={() => openObligation(o)}
                  >
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label="Eliminar gestión"
                    danger
                    onClick={() =>
                      run(
                        () => api(`/api/flota/obligations/${o.id}`, "DELETE"),
                        `¿Eliminar ${OBLIGATION_LABEL[o.type]} con todos sus pagos y comprobantes?`,
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>

              {o.payments.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vence</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Comprobantes</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {o.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="tabular-nums">
                          {fmtDate(p.dueDate)}
                          {p.notes && (
                            <div className="text-xs text-muted-foreground">
                              {p.notes}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.amount === null
                            ? "—"
                            : ARS.format(Number(p.amount))}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-0.5">
                            <StatusBadge
                              status={dueStatus(p.dueDate, p.paidAt, today)}
                            />
                            {p.paidAt && (
                              <span className="text-xs text-muted-foreground">
                                el {fmtDate(p.paidAt)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <FileChips
                            files={p.files}
                            target={{ paymentId: p.id }}
                            onChange={load}
                          />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {p.paidAt ? (
                            <IconButton
                              label="Volver a pendiente"
                              onClick={() =>
                                run(() =>
                                  api(`/api/flota/payments/${p.id}`, "PATCH", {
                                    paidAt: null,
                                  }),
                                )
                              }
                            >
                              <RotateCcw className="h-4 w-4" />
                            </IconButton>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-emerald-700"
                              onClick={() =>
                                run(() =>
                                  api(`/api/flota/payments/${p.id}`, "PATCH", {
                                    paidAt: today,
                                  }),
                                )
                              }
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Pagado hoy
                            </Button>
                          )}
                          <IconButton
                            label="Editar pago"
                            onClick={() => openPayment(o, p)}
                          >
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            label="Eliminar pago"
                            danger
                            onClick={() =>
                              run(
                                () =>
                                  api(`/api/flota/payments/${p.id}`, "DELETE"),
                                `¿Eliminar el pago del ${fmtDate(p.dueDate)} y sus comprobantes?`,
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          );
        })}
      </Card>

      {/* Service, reparaciones y repuestos */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Service, reparaciones y repuestos</h2>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => openMaintenance()}
          >
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>
        {v.maintenance.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin trabajos cargados.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="text-right">Km</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead>Próximo service</TableHead>
                <TableHead>Comprobantes</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {v.maintenance.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="tabular-nums">
                    {fmtDate(m.date)}
                  </TableCell>
                  <TableCell>{MAINTENANCE_LABEL[m.kind]}</TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    {m.description}
                    {m.provider && (
                      <div className="text-xs text-muted-foreground">
                        {m.provider}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.mileage?.toLocaleString("es-AR") ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.cost === null ? "—" : ARS.format(Number(m.cost))}
                  </TableCell>
                  <TableCell className="text-xs">
                    {[
                      m.nextDate && fmtDate(m.nextDate),
                      m.nextMileage &&
                        `${m.nextMileage.toLocaleString("es-AR")} km`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </TableCell>
                  <TableCell>
                    <FileChips
                      files={m.files}
                      target={{ maintenanceId: m.id }}
                      onChange={load}
                    />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <IconButton
                      label="Editar trabajo"
                      onClick={() => openMaintenance(m)}
                    >
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="Eliminar trabajo"
                      danger
                      onClick={() =>
                        run(
                          () => api(`/api/flota/maintenance/${m.id}`, "DELETE"),
                          "¿Eliminar este trabajo y sus comprobantes?",
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {dialog && (
        <FormDialog
          title={dialog.title}
          fields={dialog.fields}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onSubmit={async (vals) => {
            await dialog.submit(vals);
            load();
          }}
        />
      )}
    </div>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function IconButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-8 w-8 p-0 ${danger ? "text-destructive" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
