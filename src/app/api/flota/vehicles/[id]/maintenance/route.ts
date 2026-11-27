import { NextResponse } from "next/server";
import { parseMaintenance } from "@/lib/fleet";
import { fleetHandler, jsonBody } from "@/lib/fleet-server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../../../../generated/prisma/client";

export const POST = fleetHandler(async (req, vehicleId) => {
  const data = parseMaintenance(await jsonBody(req), true);
  const maintenance = await prisma.fleetMaintenance.create({
    data: { ...data, vehicleId } as Prisma.FleetMaintenanceUncheckedCreateInput,
  });
  return NextResponse.json({ maintenance }, { status: 201 });
});
