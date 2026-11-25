/**
 * GET /api/whatsapp/messages/[id]/media/[i] — adjunto de un mensaje entrante.
 * Las URLs de Twilio piden credenciales: el backoffice las sirve por acá.
 */

import { verifyAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { fetchMedia, waErrorResponse } from "@/lib/whatsapp/twilio";

type RouteContext = { params: Promise<{ id: string; i: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const authError = await verifyAuth(request);
  if (authError) return authError;
  const { id, i } = await ctx.params;

  const message = await prisma.whatsappMessage.findUnique({
    where: { id },
    select: { media: true },
  });
  const media = (Array.isArray(message?.media) ? message.media : []) as {
    url: string;
    contentType: string;
  }[];
  const entry = media[Number(i)];
  if (!entry)
    return Response.json({ error: "Adjunto no encontrado" }, { status: 404 });

  try {
    const res = await fetchMedia(entry.url);
    return new Response(res.body, {
      headers: {
        "Content-Type": entry.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return waErrorResponse(e);
  }
}
