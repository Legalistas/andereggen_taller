/**
 * Roles sin dependencias de servidor, para poder importarlos desde
 * componentes cliente (ej. el sidebar). `auth-utils` los re-exporta.
 */

/**
 * spec 9.1 · Caja, KPIs y facturación: solo dirección y el equipo contable.
 * admin_taller sigue entrando a todo lo demás.
 */
export const FINANCE_ROLES = ["super_admin", "contable"] as const;
