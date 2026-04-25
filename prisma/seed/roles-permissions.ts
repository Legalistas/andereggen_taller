import { prisma } from "../../src/lib/prisma";

type RoleType = "INTERNAL" | "EXTERNAL";

/**
 * Set de permisos granulares — keys en inglés por convención (son constantes del código).
 * Formato: `<modulo>.<accion>` o `<modulo>.<scope>_<accion>`.
 */
const PERMISSIONS: Array<{ name: string; description: string }> = [
    // Users
    { name: "view_users", description: "Ver usuarios" },
    { name: "create_users", description: "Crear usuarios" },
    { name: "edit_users", description: "Editar usuarios" },
    { name: "delete_users", description: "Eliminar usuarios" },
    { name: "disable_users", description: "Deshabilitar usuarios" },
    // Roles & permisos
    { name: "view_roles", description: "Ver roles" },
    { name: "manage_roles", description: "Crear/editar/eliminar roles y permisos" },
    // Customers
    { name: "view_customers", description: "Ver clientes (CRM)" },
    { name: "create_customers", description: "Crear clientes" },
    { name: "edit_customers", description: "Editar clientes" },
    { name: "delete_customers", description: "Eliminar clientes" },
    // Leads
    { name: "view_all_leads", description: "Ver todos los leads" },
    { name: "view_own_leads", description: "Ver solo los leads propios/asignados" },
    { name: "create_leads", description: "Crear leads" },
    { name: "edit_leads", description: "Editar leads" },
    { name: "delete_leads", description: "Eliminar leads" },
    // Budgets
    { name: "view_all_budgets", description: "Ver todos los presupuestos" },
    { name: "view_own_budgets", description: "Ver solo los presupuestos propios/asignados" },
    { name: "create_budgets", description: "Crear presupuestos" },
    { name: "edit_budgets", description: "Editar presupuestos" },
    { name: "send_budgets", description: "Enviar presupuestos al cliente" },
    { name: "approve_budgets", description: "Aprobar/rechazar presupuestos" },
    { name: "delete_budgets", description: "Eliminar presupuestos" },
    // Parts (inventario)
    { name: "view_parts", description: "Ver catálogo de repuestos" },
    { name: "create_parts", description: "Crear repuestos" },
    { name: "edit_parts", description: "Editar repuestos" },
    { name: "delete_parts", description: "Eliminar repuestos" },
    { name: "manage_parts_stock", description: "Cargar movimientos de stock" },
    // Tools (herramientas del taller)
    { name: "view_tools", description: "Ver herramientas" },
    { name: "create_tools", description: "Crear herramientas" },
    { name: "edit_tools", description: "Editar herramientas" },
    { name: "delete_tools", description: "Eliminar herramientas" },
    { name: "assign_tools", description: "Asignar herramientas a usuarios" },
    // Payments
    { name: "view_payments", description: "Ver pagos" },
    { name: "create_payments", description: "Registrar pagos" },
    { name: "edit_payments", description: "Editar pagos" },
    { name: "delete_payments", description: "Eliminar pagos" },
    // Settings
    { name: "view_settings", description: "Ver configuración" },
    { name: "edit_settings", description: "Editar configuración" },
    // Reports
    { name: "view_reports", description: "Ver reportes" },
    { name: "export_reports", description: "Exportar reportes" },
    // System (solo super_admin)
    { name: "full_system_access", description: "Acceso total al sistema (super admin)" },
];

/**
 * Roles del sistema. `permissions` es el subset de keys del array PERMISSIONS.
 * Pasar `permissions: "*"` para asignar todos los permisos.
 */
const ROLES: Array<{
    name: string;
    label: string;
    type: RoleType;
    description: string;
    isActive: boolean;
    permissions: string[] | "*";
}> = [
    {
        name: "super_admin",
        label: "Super Admin",
        type: "INTERNAL",
        description: "Rol principal del sistema. Acceso total, incluyendo configuración crítica.",
        isActive: true,
        permissions: "*",
    },
    {
        name: "admin_taller",
        label: "Administrativo del Taller",
        type: "INTERNAL",
        description:
            "Acceso completo a toda la plataforma. Es el rol principal de operación diaria.",
        isActive: true,
        permissions: PERMISSIONS.map((p) => p.name).filter(
            (n) => n !== "full_system_access",
        ),
    },
    {
        name: "contable",
        label: "Contable",
        type: "INTERNAL",
        description:
            "Acceso completo orientado al módulo contable (a desarrollar en Fase 2). Por ahora ve todo igual que el administrativo.",
        isActive: true,
        permissions: PERMISSIONS.map((p) => p.name).filter(
            (n) => n !== "full_system_access" && n !== "manage_roles",
        ),
    },
    {
        name: "cliente",
        label: "Cliente",
        type: "EXTERNAL",
        description:
            "Solo lectura. Puede ver el estado de su vehículo en reparación y recibe notificaciones automáticas por mail.",
        isActive: true,
        permissions: ["view_own_budgets", "view_own_leads"],
    },
    {
        name: "inspector",
        label: "Inspector / Perito",
        type: "EXTERNAL",
        description:
            "Puede ver cotizaciones y reparaciones asignadas. Fase 2: podrá aprobar cotizaciones directamente desde la plataforma.",
        isActive: false, // Fase 2
        permissions: ["view_own_budgets", "view_own_leads"],
    },
    {
        name: "productor_seguros",
        label: "Productor de Seguros",
        type: "EXTERNAL",
        description:
            "Puede ver cotizaciones y reparaciones vinculadas a sus clientes asegurados.",
        isActive: false, // Fase 2
        permissions: ["view_own_budgets", "view_own_leads"],
    },
    {
        name: "compania_seguros",
        label: "Compañía de Seguros",
        type: "EXTERNAL",
        description:
            "Acceso de lectura general para supervisión. Puede ver el estado global de reparaciones y cotizaciones de su cartera.",
        isActive: false, // Fase 2
        permissions: ["view_all_budgets", "view_all_leads"],
    },
    {
        name: "mecanico",
        label: "Mecánico / Operario",
        type: "INTERNAL",
        description:
            "Personal del taller que ejecuta reparaciones. Se le asignan órdenes en el Kanban de Producción.",
        isActive: true,
        permissions: ["view_own_leads", "view_own_budgets"],
    },
];

async function seedRolesAndPermissions() {
    try {
        console.log("Seeding roles y permisos...");

        // Limpieza — respeta el orden para no romper FKs
        await prisma.rolePermission.deleteMany({});
        await prisma.user.updateMany({ data: { roleId: null } });
        await prisma.customer.updateMany({ data: { roleId: null } });
        await prisma.permission.deleteMany({});
        await prisma.role.deleteMany({});

        // Permisos
        const createdPermissions = await Promise.all(
            PERMISSIONS.map((p) => prisma.permission.create({ data: p })),
        );
        const permByName = new Map(createdPermissions.map((p) => [p.name, p]));
        console.log(`  ${createdPermissions.length} permisos creados`);

        // Roles + asignación
        for (const role of ROLES) {
            const created = await prisma.role.create({
                data: {
                    name: role.name,
                    label: role.label,
                    type: role.type,
                    description: role.description,
                    isActive: role.isActive,
                },
            });

            const permNames =
                role.permissions === "*"
                    ? createdPermissions.map((p) => p.name)
                    : role.permissions;

            const links = permNames
                .map((name) => permByName.get(name))
                .filter((p): p is NonNullable<typeof p> => p !== undefined)
                .map((p) => ({ roleId: created.id, permissionId: p.id }));

            if (links.length) {
                await prisma.rolePermission.createMany({ data: links });
            }

            const status = role.isActive ? "active" : "disabled";
            console.log(
                `  ${role.name.padEnd(20)} [${role.type.padEnd(8)}] [${status.padEnd(8)}] ${permNames.length} permisos`,
            );
        }

        console.log("Listo.");
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

seedRolesAndPermissions();
