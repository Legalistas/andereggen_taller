"use client"

import { usePathname } from "next/navigation"
import { NavLink } from "./nav-link"
import { NavDropdown, type NavItem } from "./nav-dropdown"
import {
    LayoutDashboard,
    Car,
    FileText,
    BarChartBig as ChartBar,
    MoreHorizontal,
    Users,
    Package,
    Settings,
    Filter,
    UserCog,
} from "lucide-react"

export default function Navigation() {
    const pathname = usePathname()

    const crmItems: NavItem[] = [
        { label: "Leads", icon: Filter, href: "/crm/leads" },
        { label: "Cotizaciones", icon: FileText, href: "/crm/cotizaciones" },
        { label: "Seguimiento", icon: Users, href: "/crm/seguimiento" },
    ]

    const produccionItems = [
        { label: "Vista de Tablero", icon: Car, href: "/produccion" },
        { label: "Lista Completa", icon: Car, href: "/produccion/lista" },
        { label: "Histórico", icon: Car, href: "/produccion/historico" },
    ]


    const reportesItems: NavItem[] = [
        { label: "Ingresos", icon: FileText, href: "/reportes/ingresos" },
        { label: "Servicios", icon: FileText, href: "/reportes/servicios" },
        { label: "Clientes", icon: FileText, href: "/reportes/clientes" },
    ]

    const inventarioItems: NavItem[] = [
        { label: "Repuestos", icon: Package, href: "/inventario" },
        { label: "Herramientas", icon: Package, href: "/inventario/herramientas" },
        { label: "Pedidos", icon: Package },
    ]

    const moreItems: NavItem[] = [
        { label: "Clientes", icon: Users, href: "/customers" },
        { label: "Usuarios", icon: UserCog, href: "/users" },
        { label: "Estadísticas", icon: ChartBar, href: "/estadisticas" },
        { label: "Configuración", icon: Settings, href: "/configuracion" },
    ]

    return (
        <div className="border-b border-border bg-card">
            <div className="container mx-auto px-4">
                <nav className="flex items-center gap-1">
                    <NavLink
                        href="/dashboard"
                        label="Dashboard"
                        icon={LayoutDashboard}
                        isActive={pathname === "/dashboard"}
                    />

                    <NavDropdown
                        label="Embudo / CRM"
                        icon={Filter}
                        items={crmItems}
                        isActive={pathname.startsWith("/crm")}
                    />

                    <NavDropdown
                        label="Producción"
                        icon={Car}
                        items={produccionItems}
                    />

                    <NavDropdown
                        label="Reportes"
                        icon={FileText}
                        items={reportesItems}
                    />

                    <NavDropdown
                        label="Inventario"
                        icon={Package}
                        items={inventarioItems}
                    />

                    <NavDropdown
                        label="Más"
                        icon={MoreHorizontal}
                        items={moreItems}
                        align="end"
                    />
                </nav>
            </div>
        </div>
    )
}
