/**
 * Helper server-side para leer el singleton AppSettings.
 * Si aún no existe la fila (primer boot sin seed), la crea on-demand con
 * los defaults del schema.
 */

import { prisma } from "./prisma";

export async function getAppSettings() {
    return prisma.appSettings.upsert({
        where: { id: "app" },
        update: {},
        create: { id: "app" },
    });
}
