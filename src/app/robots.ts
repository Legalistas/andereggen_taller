import type { MetadataRoute } from "next";

/**
 * Robots dinámico (Next.js 13+). Como esta es la intranet del taller,
 * bloqueamos a todos los crawlers — no queremos que aparezca en Google
 * ni en buscadores públicos.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
  };
}
