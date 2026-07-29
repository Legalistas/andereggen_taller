import {
  BarChartBig,
  Calendar,
  Car,
  FileText,
  type LucideIcon,
  Package,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

export type SidebarItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

/**
 * Sidebar plana — módulos principales, sin agrupaciones.
 * Orden alineado con el flujo diario del taller.
 */
export const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: "Cotizaciones", icon: FileText, href: "/crm/leads" },
  { label: "Producción", icon: Car, href: "/produccion" },
  // spec 2.3 v2 · Módulo Calendario — reemplaza el Excel de gestión de turnos
  { label: "Calendario", icon: Calendar, href: "/calendario" },
  // spec sección 4 v2 · Módulo Caja — cobros, egresos, transferencias entre
  // las 5 cajas del taller. Administrado por el rol Contable (Ayelén).
  { label: "Caja", icon: Wallet, href: "/caja" },
  // spec Compras v2 · Ciclo completo de compras (Cotizar → Archivada, 7 estados).
  { label: "Compras", icon: ShoppingCart, href: "/compras" },
  { label: "Estadísticas", icon: BarChartBig, href: "/estadisticas" },
  { label: "Inventario", icon: Package, href: "/inventario" },
  { label: "Clientes", icon: Users, href: "/customers" },
  { label: "Usuarios", icon: UserCog, href: "/users" },
  { label: "Configuración", icon: Settings, href: "/configuracion" },
];
