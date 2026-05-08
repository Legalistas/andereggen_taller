/**
 * GET /api/crm/leads/[id]/photos
 *
 * Lista las fotos que el cliente subió desde el formulario web del landing
 * para este lead. Las fotos viven en el MinIO de `static.legalistas.com.ar`
 * bajo el folder guardado en `lead.photosFolder` (ej: `andereggen/juan-perez`).
 *
 * Devuelve URLs públicas armadas con `static.legalistas.com.ar/<bucket>/<key>`,
 * que es como las dejó el endpoint de subida del landing.
 */

import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { BUCKET, publicUrlFor, s3 } from "@/lib/minio";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i;

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, photosFolder: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (!lead.photosFolder) {
    return NextResponse.json({ photos: [], folder: null });
  }

  const folder = lead.photosFolder.replace(/^\/+|\/+$/g, "");
  const prefix = `${folder}/`;

  try {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
      }),
    );

    const photos = (result.Contents ?? [])
      .filter((o) => o.Key && o.Key !== prefix && IMAGE_EXT.test(o.Key))
      .map((o) => ({
        key: o.Key as string,
        url: publicUrlFor(o.Key as string),
        size: o.Size ?? 0,
        lastModified: o.LastModified?.toISOString() ?? null,
      }))
      .sort((a, b) => (a.lastModified ?? "").localeCompare(b.lastModified ?? ""));

    return NextResponse.json({ photos, folder });
  } catch (error) {
    console.error("[/api/crm/leads/[id]/photos] error:", error);
    return NextResponse.json(
      { error: "No se pudieron listar las fotos del lead." },
      { status: 500 },
    );
  }
}
