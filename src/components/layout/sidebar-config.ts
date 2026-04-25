import {
  BarChartBig,
  Car,
  FileText,
  type LucideIcon,
  Package,
  Settings,
  UserCog,
  Users,
} from "lucide-react";

export type SidebarItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

/**
 * Sidebar plana — 6 módulos principales, sin agrupaciones.
 * Orden alineado con el flujo diario del taller.
 */
export const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: "Cotizaciones", icon: FileText, href: "/crm/leads" },
  { label: "Producción", icon: Car, href: "/produccion" },
  { label: "Estadísticas", icon: BarChartBig, href: "/dashboard" },
  { label: "Inventario", icon: Package, href: "/inventario" },
  { label: "Clientes", icon: Users, href: "/customers" },
  { label: "Usuarios", icon: UserCog, href: "/users" },
  { label: "Configuración", icon: Settings, href: "/configuracion" },
];
