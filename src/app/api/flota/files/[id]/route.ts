import { NextResponse } from "next/server";
import {
  deleteWithFiles,
  fleetHandler,
  getFleetObject,
} from "@/lib/fleet-server";
import { prisma } from "@/lib/prisma";

/** Sirve el archivo a través del backoffice: hace falta sesión para verlo. */
export const GET = fleetHandler(async (_req, id) => {
  const file = await prisma.fleetFile.findUnique({ where: { id } });
  if (!file)
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: 404 },
    );
  const obj = await getFleetObject(file.storageKey);
  if (!obj.Body)
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: 404 },
    );
  return new Response(obj.Body.transformToWebStream(), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=300",
    },
  });
});

export const DELETE = fleetHandler(async (_req, id) => {
  await deleteWithFiles({ id }, () =>
    prisma.fleetFile.delete({ where: { id } }),
  );
  return NextResponse.json({ ok: true });
});
