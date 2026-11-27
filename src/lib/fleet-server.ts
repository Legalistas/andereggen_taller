/**
 * Flota — piezas de servidor compartidas por las rutas /api/flota/*:
 * manejo de errores y archivos en MinIO.
 */
import { randomUUID } from "node:crypto";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { FleetInputError } from "@/lib/fleet";
import { BUCKET, s3 } from "@/lib/minio";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../generated/prisma/client";

type Ctx = { params: Promise<Record<string, string>> };

/** Auth de rol interno + traducción de errores de input y de Prisma a HTTP. */
export function fleetHandler(
  fn: (req: Request, id: string) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx) => {
    const authError = await verifyAuth(req);
    if (authError) return authError;
    try {
      return await fn(req, (await ctx.params).id ?? "");
    } catch (e) {
      if (e instanceof FleetInputError)
        return NextResponse.json({ error: e.message }, { status: 400 });
      const code = (e as { code?: string })?.code;
      if (code === "P2002")
        return NextResponse.json(
          { error: "Ya existe un vehículo con esa patente" },
          { status: 409 },
        );
      // P2025 = no existe el registro; P2003 = no existe el padre.
      if (code === "P2025" || code === "P2003")
        return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      throw e;
    }
  };
}

export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new FleetInputError("Body inválido");
  return body as Record<string, unknown>;
}

// ── Archivos ─────────────────────────────────────────────────

export function fleetFileKey(vehicleId: string, fileName: string): string {
  const safe = fileName
    .normalize("NFD")
    .replace(/[^\w.-]+/g, "_")
    .slice(-80);
  return `andereggen/flota/${vehicleId}/${randomUUID()}-${safe}`;
}

export async function putFleetObject(
  key: string,
  body: Uint8Array,
  contentType: string,
) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export function getFleetObject(key: string) {
  return s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
}

async function deleteFleetObjects(keys: string[]) {
  if (!keys.length) return;
  try {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    );
  } catch (e) {
    console.error("[flota] no se pudieron borrar archivos de MinIO", keys, e);
  }
}

/**
 * Borra un registro y después los archivos de MinIO que colgaban de él.
 * Primero la DB: si falla MinIO queda un archivo huérfano en el bucket,
 * nunca una fila que apunte a un archivo inexistente.
 */
export async function deleteWithFiles(
  files: Prisma.FleetFileWhereInput,
  del: () => Promise<unknown>,
) {
  const rows = await prisma.fleetFile.findMany({
    where: files,
    select: { storageKey: true },
  });
  await del();
  await deleteFleetObjects(rows.map((r) => r.storageKey));
}

/** Lo que el cliente ve de un archivo (sin la key del bucket). */
export const FILE_SELECT = {
  select: {
    id: true,
    name: true,
    contentType: true,
    size: true,
    createdAt: true,
  },
  orderBy: { createdAt: "asc" },
} satisfies Prisma.FleetVehicle$filesArgs;
