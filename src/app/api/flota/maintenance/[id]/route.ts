import { NextResponse } from "next/server";
import { parseMaintenance } from "@/lib/fleet";
import { deleteWithFiles, fleetHandler, jsonBody } from "@/lib/fleet-server";
import { prisma } from "@/lib/prisma";

export const PATCH = fleetHandler(async (req, id) => {
  const maintenance = await prisma.fleetMaintenance.update({
    where: { id },
    data: parseMaintenance(await jsonBody(req), false),
  });
  return NextResponse.json({ maintenance });
});

export const DELETE = fleetHandler(async (_req, id) => {
  await deleteWithFiles({ maintenanceId: id }, () =>
    prisma.fleetMaintenance.delete({ where: { id } }),
  );
  return NextResponse.json({ ok: true });
});
