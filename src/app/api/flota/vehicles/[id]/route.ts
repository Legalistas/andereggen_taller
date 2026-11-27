import { NextResponse } from "next/server";
import { parseVehicle } from "@/lib/fleet";
import {
  deleteWithFiles,
  FILE_SELECT,
  fleetHandler,
  jsonBody,
} from "@/lib/fleet-server";
import { prisma } from "@/lib/prisma";

/** Ficha completa: gestiones con sus pagos, trabajos y papeles. */
export const GET = fleetHandler(async (_req, id) => {
  const vehicle = await prisma.fleetVehicle.findUnique({
    where: { id },
    include: {
      obligations: {
        orderBy: { createdAt: "asc" },
        include: {
          payments: {
            orderBy: { dueDate: "desc" },
            include: { files: FILE_SELECT },
          },
        },
      },
      maintenance: {
        orderBy: { date: "desc" },
        include: { files: FILE_SELECT },
      },
      // Papeles = archivos que no son comprobante de un pago ni de un trabajo.
      files: {
        ...FILE_SELECT,
        where: { paymentId: null, maintenanceId: null },
      },
    },
  });
  if (!vehicle)
    return NextResponse.json(
      { error: "Vehículo no encontrado" },
      { status: 404 },
    );
  return NextResponse.json({ vehicle });
});

export const PATCH = fleetHandler(async (req, id) => {
  const vehicle = await prisma.fleetVehicle.update({
    where: { id },
    data: parseVehicle(await jsonBody(req), false),
  });
  return NextResponse.json({ vehicle });
});

export const DELETE = fleetHandler(async (_req, id) => {
  await deleteWithFiles({ vehicleId: id }, () =>
    prisma.fleetVehicle.delete({ where: { id } }),
  );
  return NextResponse.json({ ok: true });
});
