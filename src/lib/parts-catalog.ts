import type { PartCategory, PartMovementType } from "../../generated/prisma/client"

export const PART_CATEGORIES: { key: PartCategory; label: string; color: string }[] = [
    { key: "CARROCERIA", label: "Carrocería", color: "bg-orange-500/10 text-orange-700 border-orange-200" },
    { key: "CRISTALERIA", label: "Cristalería", color: "bg-cyan-500/10 text-cyan-700 border-cyan-200" },
    { key: "MECANICA", label: "Mecánica", color: "bg-slate-500/10 text-slate-700 border-slate-200" },
    { key: "ELECTRICO", label: "Eléctrico", color: "bg-yellow-500/10 text-yellow-700 border-yellow-200" },
    { key: "PINTURA", label: "Pintura", color: "bg-purple-500/10 text-purple-700 border-purple-200" },
    { key: "FRENOS", label: "Frenos", color: "bg-red-500/10 text-red-700 border-red-200" },
    { key: "SUSPENSION", label: "Suspensión", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
    { key: "FILTROS", label: "Filtros", color: "bg-green-500/10 text-green-700 border-green-200" },
    { key: "ILUMINACION", label: "Iluminación", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
    { key: "INTERIOR", label: "Interior", color: "bg-pink-500/10 text-pink-700 border-pink-200" },
    { key: "OTROS", label: "Otros", color: "bg-muted text-muted-foreground border-border" },
]

export const CATEGORY_BY_KEY: Record<PartCategory, (typeof PART_CATEGORIES)[number]> =
    Object.fromEntries(PART_CATEGORIES.map((c) => [c.key, c])) as Record<
        PartCategory,
        (typeof PART_CATEGORIES)[number]
    >

export const MOVEMENT_LABEL: Record<PartMovementType, { label: string; color: string }> = {
    IN: { label: "Entrada", color: "bg-green-500/10 text-green-700 border-green-200" },
    OUT: { label: "Salida", color: "bg-red-500/10 text-red-700 border-red-200" },
    ADJUST: { label: "Ajuste", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
}
