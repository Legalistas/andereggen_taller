/**
 * POST /api/public/leads
 *
 * Endpoint **público** (sin auth) para que el formulario de contacto del
 * landing del taller cree un lead automáticamente cuando alguien solicita un
 * presupuesto. CORS abierto a cualquier origen.
 *
 * Acepta los datos que el form del landing recolecta. Como en ese momento aún
 * no tenemos la patente del vehículo, NO se crea un `CustomerVehicle`: la
 * marca, modelo, año, seguros y descripción del trabajo se persisten en
 * `lead.notes` para que el equipo del taller los vea al contactar al cliente
 * y luego complete los datos del vehículo formalmente.
 *
 * Si el email ya existe en `Customer`, se reutiliza ese cliente (no se duplica).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

interface LeadPublicBody {
  name?: string;
  email?: string;
  phone?: string;
  brand?: string;
  model?: string;
  year?: string;
  insurance?: string;
  thirdPartyInsurance?: string;
  description?: string;
  photosFolder?: string;
}

function buildNotes(body: LeadPublicBody): string {
  const lines: string[] = [];
  lines.push("--- Solicitud desde el formulario web ---");
  if (body.brand) lines.push(`Marca: ${body.brand}`);
  if (body.model) lines.push(`Modelo: ${body.model}`);
  if (body.year) lines.push(`Año: ${body.year}`);
  if (body.insurance) lines.push(`Seguro propio: ${body.insurance}`);
  if (body.thirdPartyInsurance)
    lines.push(`Seguro del tercero: ${body.thirdPartyInsurance}`);
  if (body.description) {
    lines.push("");
    lines.push("Descripción del trabajo:");
    lines.push(body.description.trim());
  }
  return lines.join("\n");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LeadPublicBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const phone = body.phone?.trim() ?? "";
  const brand = body.brand?.trim() ?? "";
  const description = body.description?.trim() ?? "";
  const photosFolder = body.photosFolder?.trim() || null;

  if (!name || !email || !phone || !brand || !description) {
    return NextResponse.json(
      {
        error:
          "Faltan campos obligatorios: name, email, phone, brand, description.",
      },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Email inválido." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    const lead = await prisma.$transaction(async (tx) => {
      let customer = await tx.customer.findUnique({ where: { email } });

      if (!customer) {
        const ar =
          (await tx.country.findUnique({ where: { code: "AR" } })) ??
          (await tx.country.findFirst({ orderBy: { name: "asc" } }));
        if (!ar) {
          throw new Error("No hay países configurados.");
        }
        const sf =
          (await tx.state.findFirst({
            where: { countryId: ar.id, name: "Santa Fe" },
          })) ??
          (await tx.state.findFirst({
            where: { countryId: ar.id },
            orderBy: { name: "asc" },
          }));
        if (!sf) {
          throw new Error("No hay provincias configuradas.");
        }

        customer = await tx.customer.create({
          data: {
            name,
            email,
            phone,
            countryId: ar.id,
            stateId: sf.id,
            city: "Rafaela",
            cp: "-",
            address: "-",
          },
        });
      }

      return tx.lead.create({
        data: {
          customerId: customer.id,
          vehicleId: null,
          status: "solicitud",
          source: "web",
          notes: buildNotes(body),
          photosFolder,
        },
        select: {
          id: true,
          status: true,
          source: true,
          photosFolder: true,
          createdAt: true,
        },
      });
    });

    return NextResponse.json(
      { ok: true, lead },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error("[/api/public/leads] error:", error);
    return NextResponse.json(
      { error: "No se pudo crear la solicitud. Intentá nuevamente." },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
