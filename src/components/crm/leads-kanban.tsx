"use client";

import {
  Car,
  ClipboardCheck,
  DollarSign,
  FileText,
  Loader2,
  MoreVertical,
  Send,
  TrendingUp,
  Trophy,
  Wrench,
  XCircle,
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
import { LeadActors } from "./lead-actors";

type LeadStatus =
  | "solicitud"
  | "control"
  | "enviado"
  | "refuerzo"
  | "pendientes_cobro"
  | "ganado"
  | "perdido";

type BudgetLite = {
  id: string;
  number: number;
  status: string;
  grandTotal: string | number;
  updatedAt: string;
};

export type Actor = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export type RepairStatusLite =
  | "turno_asignado"
  | "ingresado"
  | "pendientes_repuestos"
  | "chapa"
  | "pintura"
  | "calidad"
  | "pendientes_cobro"
  | "experiencia_cliente"
  | "archivado";

export type RepairOnLead = {
  id: string;
  status: RepairStatusLite;
  updatedAt: string;
};

export type KanbanLead = {
  id: string;
  status: LeadStatus;
  notes: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; email: string; phone: string };
  vehicle: {
    id: string;
    brand: string;
    model: string;
    year: string;
    domain: string;
  } | null;
  inspector: Actor | null;
  insuranceAgent: Actor | null;
  budgets: BudgetLite[];
  repairs: RepairOnLead[];
};

export type ActorKind = "inspector" | "insurance";

const COLUMNS: Array<{
  id: LeadStatus;
  label: string;
  icon: typeof FileText;
  headerClass: string;
  ringClass: string;
}> = [
  {
    id: "solicitud",
    label: "Solicitud",
    icon: FileText,
    headerClass: "bg-blue-50 text-blue-700 border-blue-200",
    ringClass: "ring-blue-400",
  },
  {
    id: "control",
    label: "Control",
    icon: ClipboardCheck,
    headerClass: "bg-purple-50 text-purple-700 border-purple-200",
    ringClass: "ring-purple-400",
  },
  {
    id: "enviado",
    label: "Enviado",
    icon: Send,
    headerClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
    ringClass: "ring-cyan-400",
  },
  {
    id: "refuerzo",
    label: "Refuerzo",
    icon: TrendingUp,
    headerClass: "bg-orange-50 text-orange-700 border-orange-200",
    ringClass: "ring-orange-400",
  },
  {
    id: "pendientes_cobro",
    label: "Pendientes de Cobro",
    icon: DollarSign,
    headerClass: "bg-amber-50 text-amber-800 border-amber-200",
    ringClass: "ring-amber-400",
  },
  {
    id: "ganado",
    label: "Ganado",
    icon: Trophy,
    headerClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ringClass: "ring-emerald-400",
  },
  {
    id: "perdido",
    label: "Perdido",
    icon: XCircle,
    headerClass: "bg-rose-50 text-rose-700 border-rose-200",
    ringClass: "ring-rose-400",
  },
];

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

// Colores de las etapas de Producción, para el badge en el card del kanban CRM
const REPAIR_KANBAN_LABEL: Record<RepairStatusLite, string> = {
  turno_asignado: "Turno asignado",
  ingresado: "Ingresado",
  pendientes_repuestos: "Pendientes Repuestos",
  chapa: "Chapa",
  pintura: "Pintura",
  calidad: "Calidad",
  pendientes_cobro: "Pend. Cobro",
  experiencia_cliente: "Listo / encuesta",
  archivado: "Archivado",
};

const REPAIR_KANBAN_COLOR: Record<RepairStatusLite, string> = {
  turno_asignado: "bg-slate-100 text-slate-700",
  ingresado: "bg-blue-100 text-blue-700",
  pendientes_repuestos: "bg-amber-100 text-amber-700",
  chapa: "bg-orange-100 text-orange-700",
  pintura: "bg-purple-100 text-purple-700",
  calidad: "bg-cyan-100 text-cyan-700",
  pendientes_cobro: "bg-amber-100 text-amber-800",
  experiencia_cliente: "bg-emerald-100 text-emerald-700",
  archivado: "bg-slate-200 text-slate-600",
};

type Props = {
  leads: KanbanLead[];
  loading: boolean;
  onStatusChange: (leadId: string, next: LeadStatus) => Promise<void>;
  onAssignActor: (
    leadId: string,
    kind: ActorKind,
    userId: string | null,
  ) => Promise<void>;
  onOpenDetail?: (lead: KanbanLead) => void;
  onOpenBudget?: (leadId: string) => void;
  onDelete?: (leadId: string) => void;
};

export function LeadsKanban({
  leads,
  loading,
  onStatusChange,
  onAssignActor,
  onOpenDetail,
  onOpenBudget,
  onDelete,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);
  const [movingLead, setMovingLead] = useState<string | null>(null);

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
    columnId: LeadStatus,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== columnId) setDragOverColumn(columnId);
  };

  const handleDragLeave = () => setDragOverColumn(null);

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    columnId: LeadStatus,
  ) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    setDragOverColumn(null);
    setDraggingId(null);
    if (!id) return;

    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === columnId) return;

    setMovingLead(id);
    try {
      await onStatusChange(id, columnId);
    } finally {
      setMovingLead(null);
    }
  };

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando cotizaciones…
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
      {COLUMNS.map((col) => {
        const items = leads.filter((l) => l.status === col.id);
        const totalAmount = items.reduce(
          (a, l) => a + Number(l.budgets[0]?.grandTotal ?? 0),
          0,
        );
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
            {/* Header columna */}
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

            {/* Cards */}
            <div className="flex flex-col gap-2 p-2 min-h-35">
              {items.length === 0 && (
                <p className="text-[11px] text-slate-400 text-center py-6 italic">
                  Sin cotizaciones
                </p>
              )}

              {items.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  dragging={draggingId === lead.id}
                  moving={movingLead === lead.id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onOpenDetail={onOpenDetail}
                  onOpenBudget={onOpenBudget}
                  onDelete={onDelete}
                  onMove={onStatusChange}
                  onAssignActor={onAssignActor}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadCard({
  lead,
  dragging,
  moving,
  onDragStart,
  onDragEnd,
  onOpenDetail,
  onOpenBudget,
  onDelete,
  onMove,
  onAssignActor,
}: {
  lead: KanbanLead;
  dragging: boolean;
  moving: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
  onOpenDetail?: (lead: KanbanLead) => void;
  onOpenBudget?: (leadId: string) => void;
  onDelete?: (leadId: string) => void;
  onMove: (leadId: string, next: LeadStatus) => Promise<void>;
  onAssignActor: (
    leadId: string,
    kind: ActorKind,
    userId: string | null,
  ) => Promise<void>;
}) {
  const lastBudget = lead.budgets[0];
  const amount = lastBudget ? Number(lastBudget.grandTotal) : 0;

  return (
    // biome-ignore lint/a11y/useSemanticElements: native draggable + nested interactive children (dropdown, popovers) require a div
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (dragging || moving) return;
        onOpenDetail?.(lead);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (dragging || moving) return;
          onOpenDetail?.(lead);
        }
      }}
      className={`group rounded-md border bg-white p-3 shadow-xs cursor-pointer active:cursor-grabbing transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003b73]/40 ${
        lead.source === "web" && !lead.vehicle
          ? "border-amber-400 border-l-4 hover:border-amber-500 hover:shadow-sm"
          : dragging
            ? "opacity-40"
            : "hover:border-[#003b73]/40 hover:shadow-sm"
      } ${dragging ? "opacity-40" : ""} ${moving ? "opacity-60 pointer-events-none" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {lead.customer.name}
          </p>
          {lead.customer.phone && (
            <p className="text-[11px] text-slate-500 truncate">
              {lead.customer.phone}
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
              <DropdownMenuItem onClick={() => onOpenDetail(lead)}>
                Ver detalle
              </DropdownMenuItem>
            )}
            {onOpenBudget && (
              <DropdownMenuItem onClick={() => onOpenBudget(lead.id)}>
                Cargar presupuesto
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-slate-500" disabled>
              Mover a…
            </DropdownMenuItem>
            {COLUMNS.filter((c) => c.id !== lead.status).map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => onMove(lead.id, c.id)}
              >
                <c.icon className="h-3.5 w-3.5 mr-2" />
                {c.label}
              </DropdownMenuItem>
            ))}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(lead.id)}
                  className="text-rose-600 focus:text-rose-600"
                >
                  Eliminar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {lead.vehicle && (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-600">
          <Car className="h-3 w-3 mt-0.5 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="truncate">
              {lead.vehicle.brand} {lead.vehicle.model} {lead.vehicle.year}
            </p>
            <p className="font-mono text-[10px] text-slate-500 uppercase">
              {lead.vehicle.domain}
            </p>
          </div>
        </div>
      )}

      {lastBudget && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Presup. #{lastBudget.number}</span>
          <span className="font-semibold text-slate-900 tabular-nums">
            {ARS.format(amount)}
          </span>
        </div>
      )}

      {/* Badge de estado de reparación — aparece si el lead ya está en
          producción (spec E3). El drag normal del kanban CRM no pisa este
          badge, es solo informativo. */}
      {lead.status === "ganado" && lead.repairs.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px]">
          <Wrench className="h-3 w-3 text-orange-500 shrink-0" />
          <span className="text-slate-500">En producción:</span>
          <span
            className={`px-1.5 py-0.5 rounded uppercase tracking-wider font-medium ${REPAIR_KANBAN_COLOR[lead.repairs[0].status]}`}
          >
            {REPAIR_KANBAN_LABEL[lead.repairs[0].status]}
          </span>
        </div>
      )}

      {/* Actores de la cotización (cliente + inspector + productor de seguros) */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: wrapper solo evita que los clicks en actores burbujeen al card */}
      <div
        className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <LeadActors
          leadId={lead.id}
          customer={lead.customer}
          inspector={lead.inspector}
          insuranceAgent={lead.insuranceAgent}
          onAssign={onAssignActor}
        />
        {lead.source && (
          <Badge
            variant="outline"
            className="text-[9px] h-4 px-1.5 bg-slate-50 border-slate-200 text-slate-500 font-normal uppercase tracking-wide shrink-0"
          >
            {lead.source}
          </Badge>
        )}
      </div>

      {moving && (
        <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Moviendo…
        </div>
      )}
    </div>
  );
}
