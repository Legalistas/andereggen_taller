import { ChevronRight, Home } from "lucide-react"
import Link from "next/link"

export type BreadcrumbItem = {
    label: string
    href?: string
}

/**
 * Breadcrumb simple consistente para todas las páginas del dashboard.
 * El primer ítem "Inicio" (link a /dashboard) se agrega automáticamente.
 * El último ítem se resalta (no es clickable aunque tenga href).
 *
 * Uso:
 *   <Breadcrumbs items={[{ label: "CRM" }, { label: "Leads", href: "/crm/leads" }]} />
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
    const full: BreadcrumbItem[] = [{ label: "Inicio", href: "/dashboard" }, ...items]

    return (
        <nav aria-label="breadcrumb" className="flex items-center flex-wrap gap-1.5 text-xs text-muted-foreground mb-3">
            {full.map((item, i) => {
                const isLast = i === full.length - 1
                const content =
                    i === 0 ? (
                        <span className="flex items-center gap-1">
                            <Home className="h-3 w-3" />
                            {item.label}
                        </span>
                    ) : (
                        item.label
                    )

                return (
                    <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
                        {i > 0 && <ChevronRight className="h-3 w-3 opacity-50" />}
                        {item.href && !isLast ? (
                            <Link href={item.href} className="hover:text-foreground transition-colors">
                                {content}
                            </Link>
                        ) : (
                            <span className={isLast ? "text-foreground font-medium" : ""}>
                                {content}
                            </span>
                        )}
                    </span>
                )
            })}
        </nav>
    )
}
