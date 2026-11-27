import { NextResponse } from "next/server";
import { arToday, fleetAlerts, parseVehicle } from "@/lib/fleet";
import { fleetHandler, jsonBody } from "@/lib/fleet-server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../../generated/prisma/client";

/** Lista de vehículos + vencimientos próximos de los activos. */
export const GET = fleetHandler(async () => {
  const rows = await prisma.fleetVehicle.findMany({
    orderBy: [{ isActive: "desc" }, { plate: "asc" }],
    include: {
      obligations: {
        select: {
          type: true,
          provider: true,
          validUntil: true,
          payments: {
            where: { paidAt: null },
            select: { dueDate: true, paidAt: true },
          },
        },
      },
      maintenance: {
        where: { kind: "SERVICE" },
        orderBy: { date: "desc" },
        take: 1,
        select: { kind: true, date: true, nextDate: true },
      },
    },
  });
  const alerts = fleetAlerts(
    rows.filter((v) => v.isActive),
    arToday(),
  );
  const vehicles = rows.map(({ obligations, maintenance, ...v }) => v);
  return NextResponse.json({ vehicles, alerts });
});

export const POST = fleetHandler(async (req) => {
  const data = parseVehicle(await jsonBody(req), true);
  const vehicle = await prisma.fleetVehicle.create({
    data: data as Prisma.FleetVehicleCreateInput,
  });
  return NextResponse.json({ vehicle }, { status: 201 });
});
