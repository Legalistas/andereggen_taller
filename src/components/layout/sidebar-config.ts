import {
    BarChartBig,
    Bot,
    Car,
    ClipboardList,
    FileText,
    Filter,
    Hammer,
    LayoutDashboard,
    type LucideIcon,
    Package,
    PiggyBank,
    ScrollText,
    Send,
    Settings,
    Trophy,
    UserCog,
    Users,
    Wrench,
} from "lucide-react"

export type SidebarItem = {
    label: string
    icon: LucideIcon
    href: string
}

export type SidebarGroup = {
    label: string
    items: SidebarItem[]
}

/**
 * Configuración de la sidebar. Agrupada por sección visible.
 * El orden refleja la prioridad de uso en el flujo diario del taller.
 */
export const SIDEBAR_GROUPS: SidebarGroup[] = [
    {
        label: "Principal",
        items: [
            { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
        ],
    },
    {
        label: "CRM",
        items: [
            { label: "Leads", icon: Filter, href: "/crm/leads" },
            { label: "Cotizaciones", icon: FileText, href: "/crm/cotizaciones" },
            { label: "Seguimiento", icon: Send, href: "/crm/seguimiento" },
        ],
    },
    {
        label: "Producción",
        items: [
            { label: "Tablero", icon: Car, href: "/produccion" },
            { label: "Lista completa", icon: ClipboardList, href: "/produccion/lista" },
            { label: "Histórico", icon: ScrollText, href: "/produccion/historico" },
        ],
    },
    {
        label: "Reportes",
        items: [
            { label: "Ingresos", icon: PiggyBank, href: "/reportes/ingresos" },
            { label: "Servicios", icon: Wrench, href: "/reportes/servicios" },
            { label: "Clientes", icon: Trophy, href: "/reportes/clientes" },
            { label: "Estadísticas", icon: BarChartBig, href: "/estadisticas" },
        ],
    },
    {
        label: "Inventario",
        items: [
            { label: "Repuestos", icon: Package, href: "/inventario" },
            { label: "Herramientas", icon: Hammer, href: "/inventario/herramientas" },
        ],
    },
    {
        label: "Administración",
        items: [
            { label: "Clientes", icon: Users, href: "/customers" },
            { label: "Usuarios", icon: UserCog, href: "/users" },
            { label: "Configuración", icon: Settings, href: "/configuracion" },
        ],
    },
]

// Fallback: si alguna herramienta/feature-flag futura agregara items, acá.
export const UNUSED_ICONS = { Bot } // placeholder para integraciones/IA
