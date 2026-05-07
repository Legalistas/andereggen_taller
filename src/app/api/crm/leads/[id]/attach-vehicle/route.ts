/**
 * POST /api/crm/leads/[id]/attach-vehicle
 *
 * Crea un `CustomerVehicle` para el customer del lead y lo vincula al lead.
 * Pensado para "completar" leads que entraron por el formulario web (source=web)
 * sin patente: el staff revisa los datos en notas, agrega la patente y este
 * endpoint hace la creación + vínculo en una sola transacción.
 *
 * Si el lead ya tiene un vehículo asignado, devuelve 409.
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

interface AttachVehicleBody {
  brand?: string;
  model?: string;
  year?: string;
  domain?: string;
  chassis?: string;
  insurance?: string;
  thirdPartyInsurance?: string;
  coverageType?: "todo_riesgo" | "terceros" | null;
  franchise?: number | string | null;
  perladoTricapa?: boolean;
  /** Si viene true, limpia las notas auto-generadas por el form web tras crear el vehicle. */
  clearWebNotes?: boolean;
}

export async function POST(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as AttachVehicleBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const brand = body.brand?.trim() ?? "";
  const model = body.model?.trim() ?? "";
  const year = body.year?.trim() ?? "";
  const domain = body.domain?.trim() ?? "";

  if (!brand || !model || !year || !domain) {
    return NextResponse.json(
      { error: "brand, model, year y domain son obligatorios" },
      { status: 400 },
    );
  }

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, customerId: true, vehicleId: true, notes: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (lead.vehicleId) {
    return NextResponse.json(
      { error: "Este lead ya tiene un vehículo asignado." },
      { status: 409 },
    );
  }

  const cov =
    body.coverageType === "todo_riesgo" || body.coverageType === "terceros"
      ? body.coverageType
      : null;
  const fr =
    cov === "todo_riesgo" &&
    body.franchise !== null &&
    body.franchise !== undefined &&
    body.franchise !== ""
      ? Number(body.franchise)
      : null;

  const updated = await prisma.$transaction(async (tx) => {
    const vehicle = await tx.customerVehicle.create({
      data: {
        customerId: lead.customerId,
        brand,
        model,
        year,
        domain,
        chassis: body.chassis?.trim() || null,
        secure: body.insurance?.trim() ?? "",
        thirdPartySecure: body.thirdPartyInsurance?.trim() ?? "",
        coverageType: cov,
        franchise: fr,
        perladoTricapa: Boolean(body.perladoTricapa),
      },
    });

    const nextNotes = body.clearWebNotes
      ? extractDescriptionOnly(lead.notes)
      : lead.notes;

    return tx.lead.update({
      where: { id },
      data: {
        vehicleId: vehicle.id,
        ...(body.clearWebNotes && { notes: nextNotes }),
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            domain: true,
          },
        },
      },
    });
  });

  return NextResponse.json({ lead: updated }, { status: 201 });
}

/**
 * Si las notas vienen del form web, deja solo la descripción del trabajo (lo
 * útil para el equipo); el resto ya pasó a la ficha del vehículo.
 */
function extractDescriptionOnly(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/Descripci[oó]n del trabajo:\s*\n([\s\S]*)$/i);
  return m ? m[1].trim() || null : notes;
}
