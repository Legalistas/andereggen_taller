import { NextResponse } from "next/server";
import { FleetInputError, MAX_FILE_BYTES } from "@/lib/fleet";
import {
  FILE_SELECT,
  fleetFileKey,
  fleetHandler,
  putFleetObject,
} from "@/lib/fleet-server";
import { prisma } from "@/lib/prisma";

const field = (form: FormData, k: string) => {
  const v = form.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/**
 * Sube un papel del vehículo (vehicleId) o el comprobante de un pago
 * (paymentId) o de un trabajo (maintenanceId). El vehículo se deduce del
 * padre, así un comprobante nunca queda colgado del vehículo equivocado.
 */
export const POST = fleetHandler(async (req) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File) || file.size === 0)
    throw new FleetInputError("Falta el archivo");
  if (file.size > MAX_FILE_BYTES)
    throw new FleetInputError("El archivo supera los 4 MB");
  if (!/^(image\/|application\/pdf$)/.test(file.type))
    throw new FleetInputError("Solo se aceptan imágenes o PDF");

  const paymentId = field(form, "paymentId");
  const maintenanceId = field(form, "maintenanceId");
  const vehicleId = paymentId
    ? (
        await prisma.fleetPayment.findUnique({
          where: { id: paymentId },
          select: { obligation: { select: { vehicleId: true } } },
        })
      )?.obligation.vehicleId
    : maintenanceId
      ? (
          await prisma.fleetMaintenance.findUnique({
            where: { id: maintenanceId },
            select: { vehicleId: true },
          })
        )?.vehicleId
      : (
          await prisma.fleetVehicle.findUnique({
            where: { id: field(form, "vehicleId") ?? "" },
            select: { id: true },
          })
        )?.id;
  if (!vehicleId)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const storageKey = fleetFileKey(vehicleId, file.name);
  await putFleetObject(
    storageKey,
    new Uint8Array(await file.arrayBuffer()),
    file.type,
  );
  const created = await prisma.fleetFile.create({
    data: {
      vehicleId,
      paymentId,
      maintenanceId,
      name: field(form, "name") ?? file.name,
      storageKey,
      contentType: file.type,
      size: file.size,
    },
    select: FILE_SELECT.select,
  });
  return NextResponse.json({ file: created }, { status: 201 });
});
