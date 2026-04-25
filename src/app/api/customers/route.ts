import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);

  const customers = await prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { dni: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      vehicles: {
        select: {
          id: true,
          brand: true,
          model: true,
          year: true,
          domain: true,
          secure: true,
        },
      },
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  return NextResponse.json({ customers });
}

/**
 * POST /api/customers — crea un cliente nuevo.
 * Body: { name, email, phone, dni?, dniType?, countryId?, stateId?, city?, cp?, address? }
 * Si no se mandan country/state, se completan con AR/Santa Fe (defaults locales).
 */
export async function POST(request: Request) {
  const authError = await verifyAuth(request);
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const {
    name,
    email,
    phone,
    dni,
    dniType,
    countryId,
    stateId,
    city,
    cp,
    address,
  } = body as Record<string, unknown>;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 },
    );
  }
  if (!email || typeof email !== "string" || !email.trim()) {
    return NextResponse.json(
      { error: "El email es obligatorio" },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json(
      { error: "Email con formato inválido" },
      { status: 400 },
    );
  }
  if (!phone || typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json(
      { error: "El teléfono es obligatorio" },
      { status: 400 },
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const dupe = await prisma.customer.findUnique({
    where: { email: normalizedEmail },
  });
  if (dupe) {
    return NextResponse.json(
      { error: `Ya existe un cliente con el email ${normalizedEmail}.` },
      { status: 409 },
    );
  }

  // Defaults de país/provincia si no vienen
  let resolvedCountryId = (countryId as string) || undefined;
  let resolvedStateId = (stateId as string) || undefined;

  if (!resolvedCountryId) {
    const ar =
      (await prisma.country.findUnique({ where: { code: "AR" } })) ??
      (await prisma.country.findFirst({ orderBy: { name: "asc" } }));
    resolvedCountryId = ar?.id;
  }
  if (!resolvedStateId && resolvedCountryId) {
    const sf =
      (await prisma.state.findFirst({
        where: { countryId: resolvedCountryId, name: "Santa Fe" },
      })) ??
      (await prisma.state.findFirst({
        where: { countryId: resolvedCountryId },
        orderBy: { name: "asc" },
      }));
    resolvedStateId = sf?.id;
  }

  if (!resolvedCountryId || !resolvedStateId) {
    return NextResponse.json(
      {
        error:
          "No hay países/provincias configurados. Corré el seed countries-states.",
      },
      { status: 500 },
    );
  }

  const customer = await prisma.customer.create({
    data: {
      name: (name as string).trim(),
      email: normalizedEmail,
      phone: (phone as string).trim(),
      dni: dni ? (dni as string).trim() : null,
      dniType: dniType ? (dniType as string).trim() : null,
      countryId: resolvedCountryId,
      stateId: resolvedStateId,
      city: city ? (city as string).trim() : "Rafaela",
      cp: cp ? (cp as string).trim() : "-",
      address: address ? (address as string).trim() : "-",
    },
    include: { vehicles: true },
  });

  return NextResponse.json({ customer }, { status: 201 });
}
