import type { ToolCategory, ToolStatus } from "../../generated/prisma/client";

export const TOOL_CATEGORIES: {
  key: ToolCategory;
  label: string;
  color: string;
}[] = [
  {
    key: "NEUMATICA",
    label: "Neumática",
    color: "bg-cyan-500/10 text-cyan-700 border-cyan-200",
  },
  {
    key: "HIDRAULICA",
    label: "Hidráulica",
    color: "bg-blue-500/10 text-blue-700 border-blue-200",
  },
  {
    key: "ELECTRICA",
    label: "Eléctrica",
    color: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  },
  {
    key: "MANUAL",
    label: "Manual",
    color: "bg-slate-500/10 text-slate-700 border-slate-200",
  },
  {
    key: "ELEVACION",
    label: "Elevación",
    color: "bg-orange-500/10 text-orange-700 border-orange-200",
  },
  {
    key: "SOLDADURA",
    label: "Soldadura",
    color: "bg-red-500/10 text-red-700 border-red-200",
  },
  {
    key: "PINTURA",
    label: "Pintura",
    color: "bg-purple-500/10 text-purple-700 border-purple-200",
  },
  {
    key: "DIAGNOSTICO",
    label: "Diagnóstico",
    color: "bg-indigo-500/10 text-indigo-700 border-indigo-200",
  },
  {
    key: "OTROS",
    label: "Otros",
    color: "bg-muted text-muted-foreground border-border",
  },
];

export const TOOL_CATEGORY_BY_KEY: Record<
  ToolCategory,
  (typeof TOOL_CATEGORIES)[number]
> = Object.fromEntries(TOOL_CATEGORIES.map((c) => [c.key, c])) as Record<
  ToolCategory,
  (typeof TOOL_CATEGORIES)[number]
>;

export const TOOL_STATUS_CONFIG: Record<
  ToolStatus,
  { label: string; color: string; dot: string }
> = {
  AVAILABLE: {
    label: "Disponible",
    color: "bg-green-500/10 text-green-700 border-green-200",
    dot: "bg-green-500",
  },
  IN_USE: {
    label: "En uso",
    color: "bg-blue-500/10 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  MAINTENANCE: {
    label: "Mantenimiento",
    color: "bg-orange-500/10 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  RETIRED: {
    label: "Dada de baja",
    color: "bg-gray-500/10 text-gray-700 border-gray-200",
    dot: "bg-gray-500",
  },
};
