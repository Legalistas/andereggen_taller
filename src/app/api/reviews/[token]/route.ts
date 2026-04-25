import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Endpoints públicos (sin auth) para la encuesta de satisfacción.
 * El token único en la URL es el "secret" que valida al cliente.
 *
 * GET  /api/reviews/[token]  → devuelve info del rating (si ya respondió o no)
 *                              + contexto del taller (cliente, vehículo).
 * POST /api/reviews/[token]  → guarda la respuesta { stars, comment }.
 *                              Solo permite responder UNA vez (idempotencia).
 */

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, ctx: RouteContext) {
  const { token } = await ctx.params;

  const rating = await prisma.serviceRating.findUnique({
    where: { token },
    include: {
      repair: {
        select: {
          customerName: true,
          vehicleBrand: true,
          vehicleModel: true,
          vehicleYear: true,
          vehicleDomain: true,
        },
      },
    },
  });

  if (!rating) {
    return NextResponse.json(
      { error: "Encuesta no encontrada o link inválido" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    rating: {
      stars: rating.stars,
      comment: rating.comment,
      respondedAt: rating.respondedAt,
    },
    repair: rating.repair,
    alreadyAnswered: rating.respondedAt !== null,
  });
}

export async function POST(request: Request, ctx: RouteContext) {
  const { token } = await ctx.params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { stars, comment } = body as { stars?: number; comment?: string };
  if (
    typeof stars !== "number" ||
    !Number.isInteger(stars) ||
    stars < 1 ||
    stars > 5
  ) {
    return NextResponse.json(
      { error: "Stars debe ser un entero entre 1 y 5" },
      { status: 400 },
    );
  }

  const rating = await prisma.serviceRating.findUnique({ where: { token } });
  if (!rating) {
    return NextResponse.json(
      { error: "Encuesta no encontrada" },
      { status: 404 },
    );
  }
  if (rating.respondedAt) {
    return NextResponse.json(
      { error: "Esta encuesta ya fue respondida" },
      { status: 409 },
    );
  }

  // IP del cliente (mejor esfuerzo — para auditoría)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    null;

  const updated = await prisma.serviceRating.update({
    where: { token },
    data: {
      stars,
      comment: comment?.trim() || null,
      respondedAt: new Date(),
      respondedIp: ip,
    },
  });

  return NextResponse.json({
    ok: true,
    rating: {
      stars: updated.stars,
      comment: updated.comment,
      respondedAt: updated.respondedAt,
    },
  });
}
