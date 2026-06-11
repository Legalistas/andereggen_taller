"use client";

import {
  Archive,
  Calendar,
  Car,
  ClipboardCheck,
  DollarSign,
  Loader2,
  MoreVertical,
  Package,
  Paintbrush,
  Shield,
  Smile,
  Star,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RepairStatus =
  | "turno_asignado"
  | "ingresado"
  | "pendientes_repuestos"
  | "chapa"
  | "pintura"
  | "calidad"
  | "pendientes_cobro"
  | "experiencia_cliente"
  | "archivado";

export type KanbanRepair = {
  id: string;
  status: RepairStatus;
  /** Nº interno del taller — sale en la card del kanban, repair canvas y Ficha Técnica */
  internalNumber: number | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleDomain: string;
  /** Compañía de seguros que paga — snapshot al crear el repair. Aparece
   *  en la card del kanban mientras el auto está en taller. */
  insuranceCompany: string | null;
  reason: string | null;
  directCreation: boolean;
  scheduledAt: string | null;
  enteredAt: string | null;
  partsReceivedAt: string | null;
  estimatedDeliveryAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
  assignedMechanic: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  budget: {
    id: string;
    number: number;
    grandTotal: string | number;
  } | null;
  /** Saldo pendiente de cobro (facturado − cobrado). null si todavía no hay
   *  facturas cargadas. Se muestra en la card cuando el repair está en la
   *  columna "Pendientes de Cobro". */
  pendingAmount: number | null;
  /** Suma de los importes aprobados (seguro + franquicia + particular).
   *  null si todavía no se cargó ninguno. Cuando existe, reemplaza al
   *  grandTotal del presupuesto en la card — es el importe que realmente
   *  vamos a cobrar y suele diferir del ppto inicial. */
  approvedTotal: number | null;
  serviceRating: {
    stars: number | null;
    respondedAt: string | null;
    token: string;
  } | null;
};

const COLUMNS: Array<{
  id: RepairStatus;
  label: string;
  icon: typeof Calendar;
  headerClass: string;
  ringClass: string;
}> = [
  {
    id: "turno_asignado",
    label: "Turno Asignado",
    icon: Calendar,
    headerClass: "bg-slate-50 text-slate-700 border-slate-200",
    ringClass: "ring-slate-400",
  },
  {
    id: "pendientes_repuestos",
    label: "Pendientes de Repuestos",
    icon: Package,
    headerClass: "bg-amber-50 text-amber-700 border-amber-200",
    ringClass: "ring-amber-400",
  },
  {
    id: "chapa",
    label: "Chapa",
    icon: Wrench,
    headerClass: "bg-orange-50 text-orange-700 border-orange-200",
    ringClass: "ring-orange-400",
  },
  {
    id: "pintura",
    label: "Pintura",
    icon: Paintbrush,
    headerClass: "bg-purple-50 text-purple-700 border-purple-200",
    ringClass: "ring-purple-400",
  },
  {
    id: "calidad",
    label: "Calidad",
    icon: ClipboardCheck,
    headerClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
    ringClass: "ring-cyan-400",
  },
  // Experiencia del Cliente va ANTES de Pendientes de Cobro: la encuesta se
  // dispara al retirarse el vehículo (deliveredAt) — esperar al cobro del
  // seguro (30/40 días) demora demasiado el envío del rating.
  {
    id: "experiencia_cliente",
    label: "Experiencia del Cliente",
    icon: Smile,
    headerClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ringClass: "ring-emerald-400",
  },
  {
    id: "pendientes_cobro",
    label: "Pendientes de Cobro",
    icon: DollarSign,
    headerClass: "bg-amber-50 text-amber-800 border-amber-200",
    ringClass: "ring-amber-400",
  },
  {
    id: "archivado",
    label: "Archivado",
    icon: Archive,
    headerClass: "bg-slate-100 text-slate-600 border-slate-300",
    ringClass: "ring-slate-400",
  },
];

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

type Props = {
  repairs: KanbanRepair[];
  loading: boolean;
  onStatusChange: (repairId: string, next: RepairStatus) => Promise<void>;
  onOpenDetail?: (repair: KanbanRepair) => void;
  onDelete?: (repairId: string) => void;
};

export function ProductionKanban({
  repairs,
  loading,
  onStatusChange,
  onOpenDetail,
  onDelete,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<RepairStatus | null>(
    null,
  );
  const [movingRepair, setMovingRepair] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    columnId: RepairStatus,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== columnId) setDragOverColumn(columnId);
  };

  const handleDragLeave = () => setDragOverColumn(null);

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    columnId: RepairStatus,
  ) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    setDragOverColumn(null);
    setDraggingId(null);
    if (!id) return;

    const repair = repairs.find((r) => r.id === id);
    if (!repair || repair.status === columnId) return;

    setMovingRepair(id);
    try {
      await onStatusChange(id, columnId);
    } finally {
      setMovingRepair(null);
    }
  };

  if (loading && repairs.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando reparaciones…
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
      {COLUMNS.map((col) => {
        const items = repairs.filter((r) => r.status === col.id);
        // La suma del header refleja el mismo criterio que cada card:
        //  - Pendientes de Cobro → pendingAmount (saldo por cobrar)
        //  - Resto con aprobación → approvedTotal (lo que vamos a cobrar)
        //  - Resto → grandTotal del ppto
        const totalAmount = items.reduce((a, r) => {
          if (col.id === "pendientes_cobro" && r.pendingAmount !== null) {
            return a + r.pendingAmount;
          }
          if (r.approvedTotal !== null) return a + r.approvedTotal;
          return a + Number(r.budget?.grandTotal ?? 0);
        }, 0);
        const Icon = col.icon;
        const isDropTarget = dragOverColumn === col.id;

        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: drop zone nativo HTML5 DnD — no hay rol ARIA estándar para esto
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
            className={`w-72 shrink-0 rounded-lg border bg-slate-50/50 transition-colors ${
              isDropTarget
                ? `ring-2 ring-offset-1 ${col.ringClass} bg-white`
                : "border-slate-200"
            }`}
          >
            <div
              className={`flex items-center justify-between gap-2 rounded-t-lg border-b px-3 py-2.5 ${col.headerClass}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="font-semibold text-sm truncate">
                  {col.label}
                </span>
                <Badge
                  variant="outline"
                  className="bg-white/60 border-current text-[10px] font-semibold h-5 px-1.5"
                >
                  {items.length}
                </Badge>
              </div>
              {totalAmount > 0 && (
                <span className="text-[11px] font-medium tabular-nums opacity-80 truncate">
                  {ARS.format(totalAmount)}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 p-2 min-h-35">
              {items.length === 0 && (
                <p className="text-[11px] text-slate-400 text-center py-6 italic">
                  Sin reparaciones
                </p>
              )}

              {items.map((r) => (
                <RepairCard
                  key={r.id}
                  repair={r}
                  dragging={draggingId === r.id}
                  moving={movingRepair === r.id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onOpenDetail={onOpenDetail}
                  onDelete={onDelete}
                  onMove={onStatusChange}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RepairCard({
  repair,
  dragging,
  moving,
  onDragStart,
  onDragEnd,
  onOpenDetail,
  onDelete,
  onMove,
}: {
  repair: KanbanRepair;
  dragging: boolean;
  moving: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
  onOpenDetail?: (repair: KanbanRepair) => void;
  onDelete?: (repairId: string) => void;
  onMove: (repairId: string, next: RepairStatus) => Promise<void>;
}) {
  const delivery = deliveryStatus(repair);
  const hasBudget = !!repair.budget;

  return (
    // biome-ignore lint/a11y/useSemanticElements: native draggable + nested interactive children
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => onDragStart(e, repair.id)}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (dragging || moving) return;
        onOpenDetail?.(repair);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (dragging || moving) return;
          onOpenDetail?.(repair);
        }
      }}
      className={`group rounded-md border bg-white p-3 shadow-xs cursor-pointer active:cursor-grabbing transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003b73]/40 ${
        dragging ? "opacity-40" : "hover:border-[#003b73]/40 hover:shadow-sm"
      } ${moving ? "opacity-60 pointer-events-none" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {repair.internalNumber !== null && (
              <span className="font-mono bg-[#003b73] text-white px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0">
                #{repair.internalNumber}
              </span>
            )}
            <p className="text-sm font-semibold text-slate-900 truncate">
              {repair.customerName}
            </p>
          </div>
          {repair.customerPhone && (
            <p className="text-[11px] text-slate-500 truncate">
              {repair.customerPhone}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 shrink-0"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {onOpenDetail && (
              <DropdownMenuItem onClick={() => onOpenDetail(repair)}>
                Ver detalle
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-slate-500" disabled>
              Mover a…
            </DropdownMenuItem>
            {COLUMNS.filter((c) => c.id !== repair.status).map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => onMove(repair.id, c.id)}
              >
                <c.icon className="h-3.5 w-3.5 mr-2" />
                {c.label}
              </DropdownMenuItem>
            ))}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(repair.id)}
                  className="text-rose-600 focus:text-rose-600"
                >
                  Eliminar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-600">
        <Car className="h-3 w-3 mt-0.5 shrink-0 text-slate-400" />
        <div className="min-w-0">
          <p className="truncate">
            {repair.vehicleBrand} {repair.vehicleModel} {repair.vehicleYear}
          </p>
          <p className="font-mono text-[10px] text-slate-500 uppercase">
            {repair.vehicleDomain}
          </p>
        </div>
      </div>

      {/* Compañía aseguradora: visible mientras el vehículo está en taller
          y durante Pendientes de Cobro. Ayuda al taller a saber rápido quién
          paga (cliente particular vs aseguradora) sin abrir el detalle. */}
      {repair.insuranceCompany && repair.status !== "archivado" && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200 text-sky-800 px-1.5 py-0.5 text-[10px] font-medium max-w-full">
          <Shield className="h-3 w-3 shrink-0" />
          <span className="truncate">{repair.insuranceCompany}</span>
        </div>
      )}

      {/* Badge prominente para reparaciones en "Pendientes de Repuestos".
          Punto de dolor clave para aseguradoras: visibilidad sobre el momento
          en que el taller recibió todos los repuestos. */}
      {repair.status === "pendientes_repuestos" && repair.partsReceivedAt && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 px-2 py-1 text-[10px] font-semibold">
          <Package className="h-3 w-3" />
          <span className="flex-1">Repuestos completos · listos para producción</span>
          <span className="font-normal opacity-75">{formatShortDate(repair.partsReceivedAt)}</span>
        </div>
      )}

      {/* E2.B — Estado de la encuesta de satisfacción.
          Aparece desde "experiencia_cliente" en adelante. */}
      {repair.serviceRating && (
        <div className="mt-2">
          {repair.serviceRating.respondedAt && repair.serviceRating.stars ? (
            <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-1 text-[10px] font-medium">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-3 w-3 ${
                      repair.serviceRating &&
                      repair.serviceRating.stars !== null &&
                      n <= repair.serviceRating.stars
                        ? "fill-amber-400 text-amber-400"
                        : "text-emerald-200"
                    }`}
                  />
                ))}
              </div>
              <span className="font-semibold tabular-nums">
                {repair.serviceRating.stars}/5
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 px-2 py-1 text-[10px]">
              <Star className="h-3 w-3 text-slate-400" />
              <span className="italic">Esperando rating del cliente</span>
            </div>
          )}
        </div>
      )}

      {hasBudget && repair.budget && (() => {
        // El importe principal de la card se elige en cascada según el
        // estado del repair, para mostrar siempre el número que importa:
        //  1. En "Pendientes de Cobro": el saldo pendiente (facturado −
        //     cobrado). Es lo que el admin necesita ver de un vistazo.
        //  2. Si ya hay aprobación de seguro/cliente: el total aprobado
        //     (lo que efectivamente vamos a cobrar).
        //  3. Default: el grandTotal del presupuesto.
        const showPending =
          repair.status === "pendientes_cobro" && repair.pendingAmount !== null;
        const showApproved = !showPending && repair.approvedTotal !== null;

        let label: string;
        let badge: { text: string; class: string; title: string } | null = null;
        let amount: number;
        let amountClass = "text-slate-900";

        if (showPending) {
          label = `Pendiente #${repair.budget.number}`;
          amount = repair.pendingAmount as number;
          amountClass =
            amount > 0
              ? "text-rose-600"
              : "text-emerald-600";
        } else if (showApproved) {
          label = `Presup. #${repair.budget.number}`;
          badge = {
            text: "aprobado",
            class:
              "bg-emerald-50 border-emerald-200 text-emerald-700",
            title:
              "El seguro/cliente ya aprobó los importes. Se muestra el total aprobado en lugar del total del presupuesto.",
          };
          amount = repair.approvedTotal as number;
        } else {
          label = `Presup. #${repair.budget.number}`;
          amount = Number(repair.budget.grandTotal);
        }

        return (
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 flex items-center gap-1">
              {label}
              {badge && (
                <span
                  className={`text-[9px] px-1 py-px rounded border font-medium ${badge.class}`}
                  title={badge.title}
                >
                  {badge.text}
                </span>
              )}
            </span>
            <span className={`font-semibold tabular-nums ${amountClass}`}>
              {ARS.format(amount)}
            </span>
          </div>
        );
      })()}

      {(repair.directCreation || delivery) && (
        <div
          className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-end gap-1"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {repair.directCreation && (
            <Badge
              variant="outline"
              className="text-[9px] h-4 px-1.5 bg-indigo-50 border-indigo-200 text-indigo-600 font-normal"
            >
              Directa
            </Badge>
          )}
          {delivery && (
            <span
              className={`text-[10px] tabular-nums font-medium ${delivery.toneClass}`}
              title={delivery.tooltip}
            >
              {delivery.label}
            </span>
          )}
        </div>
      )}

      {/* Botón rápido para cards en "Turno Asignado":
          mueve directo a "Pendientes de Repuestos" sin tener que drag'n'drop. */}
      {repair.status === "turno_asignado" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (moving) return;
            onMove(repair.id, "pendientes_repuestos");
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          disabled={moving}
          className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50"
        >
          <Package className="h-3 w-3" />
          Pasar a Pendientes de Repuestos
        </button>
      )}

      {moving && (
        <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Moviendo…
        </div>
      )}
    </div>
  );
}

/**
 * Indicador de "fecha de entrega" para la card del Kanban.
 *
 * Se calcula desde Repair.estimatedDeliveryAt y muestra:
 *   - "Hoy"           cuando la entrega cae el día actual
 *   - "X d"           cuando faltan X días (verde si ≥ 3 / amber si 1-2)
 *   - "X d atraso"    cuando ya está atrasada (rojo)
 *   - "Entregada"     cuando ya tiene deliveredAt o está archivada
 *   - null            cuando no hay fecha de entrega cargada
 */
function deliveryStatus(repair: KanbanRepair): {
  label: string;
  toneClass: string;
  tooltip: string;
} | null {
  // Ya entregada / archivada → no mostramos contador
  if (repair.archivedAt || repair.status === "archivado") {
    return {
      label: "Entregada",
      toneClass: "text-slate-400",
      tooltip: "Reparación archivada",
    };
  }

  if (!repair.estimatedDeliveryAt) return null;

  const target = new Date(repair.estimatedDeliveryAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000,
  );

  const formatted = target.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });

  if (diffDays < 0) {
    const lateBy = Math.abs(diffDays);
    return {
      label: `${lateBy}d atraso`,
      toneClass: "text-rose-600",
      tooltip: `Entrega prevista ${formatted} — ${lateBy} día${lateBy === 1 ? "" : "s"} de atraso`,
    };
  }
  if (diffDays === 0) {
    return {
      label: "Hoy",
      toneClass: "text-amber-600",
      tooltip: `Entrega prevista hoy (${formatted})`,
    };
  }
  if (diffDays <= 2) {
    return {
      label: `${diffDays}d`,
      toneClass: "text-amber-600",
      tooltip: `Faltan ${diffDays} día${diffDays === 1 ? "" : "s"} — entrega ${formatted}`,
    };
  }
  return {
    label: `${diffDays}d`,
    toneClass: "text-emerald-600",
    tooltip: `Faltan ${diffDays} días — entrega ${formatted}`,
  };
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}
