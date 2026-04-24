/**
 * Catálogo de presupuesto — categorías (Nivel 1) y subdetalles (Nivel 2).
 * Fuente: "REQUERIMIENTOS BACKOFFICE TALLER" (PDF), secciones 1 y 3.1–3.5.
 *
 * Hardcoded en TS para el MVP. Si eventualmente hace falta editar desde el
 * admin, se migra a tabla Prisma sin romper contratos (los `key` son estables).
 */

import type { ConceptCategory, ConceptType } from "../../generated/prisma/client";

export type CategoryDef = {
  key: ConceptCategory;
  label: string;
  type: ConceptType;
  /** Etiqueta del campo de importe para categorías FIJO */
  fixedLabel?: string;
  /** Hint de ayuda visible bajo el título del concepto */
  hint?: string;
};

export const CATEGORIES: CategoryDef[] = [
  // --- Descriptivas (sin importe) ---
  { key: "DESMONTAR", label: "Desmontar", type: "DESCRIPTIVO" },
  { key: "DESMONTAR_Y_REPARAR", label: "Desmontar y reparar", type: "DESCRIPTIVO" },
  { key: "DESMONTAR_Y_CAMBIAR", label: "Desmontar y cambiar", type: "DESCRIPTIVO" },
  { key: "BANCADA_DE_ESTIRAMIENTO", label: "Bancada de estiramiento", type: "DESCRIPTIVO" },
  { key: "DESABOLLAR", label: "Desabollar", type: "DESCRIPTIVO" },

  // --- Por unidades (chapa / pintura) ---
  { key: "CHAPA", label: "Chapa (incluye armado)", type: "UNIDADES", hint: "Unidades × valor" },
  { key: "PINTURA", label: "Pintura (incluye lavado y pulido)", type: "UNIDADES", hint: "Unidades × valor" },

  // --- Importe fijo ---
  { key: "MECANICA", label: "Mecánica", type: "FIJO", fixedLabel: "Importe mecánica" },
  { key: "ALINEACION_BALANCEO", label: "Alineación – Balanceo", type: "FIJO" },
  { key: "AIRE_ACONDICIONADO", label: "Aire acondicionado", type: "FIJO" },
  { key: "AIRBAGS", label: "Airbags (montaje y reseteo)", type: "FIJO" },
  { key: "COLOCACION_PARABRISAS", label: "Colocación parabrisas (kit pegamento)", type: "FIJO" },
  { key: "COLOCACION_LUNETA", label: "Colocación luneta (kit pegamento)", type: "FIJO" },
  { key: "PULIDO_COMPLETO", label: "Pulido completo", type: "FIJO" },
  { key: "OTROS_ADICIONALES", label: "Otros / Adicionales", type: "FIJO", hint: "Descripción libre + importe" },
];

export const CATEGORY_BY_KEY: Record<ConceptCategory, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<ConceptCategory, CategoryDef>;

// =====================================================
// Subdetalles (Nivel 2) — solo categorías DESCRIPTIVO
// Key estable (slug) + label mostrado. Agrupado por bloque visual del PDF.
// =====================================================

export type SubdetailGroup = {
  title: string;
  items: { key: string; label: string }[];
};

export type SubdetailCatalog = Partial<Record<ConceptCategory, SubdetailGroup[]>>;

export const SUBDETAILS: SubdetailCatalog = {
  // --- 3.1 DESMONTAR ---
  DESMONTAR: [
    {
      title: "Guardaplást",
      items: [
        { key: "guardaplast_ambos_delanteros", label: "Ambos guardaplást delanteros" },
        { key: "guardaplast_ambos_traseros", label: "Ambos guardaplást traseros" },
        { key: "guardaplast_del_izq", label: "Guardaplást delantero izquierdo" },
        { key: "guardaplast_del_der", label: "Guardaplást delantero derecho" },
        { key: "guardaplast_tras_izq", label: "Guardaplást trasero izquierdo" },
        { key: "guardaplast_tras_der", label: "Guardaplást trasero derecho" },
      ],
    },
    {
      title: "Tapizados de baúl / portón",
      items: [
        { key: "tapizado_porton_trasero", label: "Tapizado interior de portón trasero" },
        { key: "tapizado_baul", label: "Tapizado interior de baúl" },
        { key: "tapizado_tapa_baul", label: "Tapizado interior de tapa de baúl" },
      ],
    },
    {
      title: "Tapizados de puertas — ambos",
      items: [
        { key: "tapizado_ambos_puertas_izq", label: "Ambos tapizados interiores de puertas izquierdas" },
        { key: "tapizado_ambos_puertas_der", label: "Ambos tapizados interiores de puertas derechas" },
      ],
    },
    {
      title: "Tapizados de puertas — por puerta",
      items: [
        { key: "tapizado_puerta_del_izq", label: "Tapizado interior de puerta delantera izquierda" },
        { key: "tapizado_puerta_del_der", label: "Tapizado interior de puerta delantera derecha" },
        { key: "tapizado_puerta_tras_izq", label: "Tapizado interior de puerta trasera izquierda" },
        { key: "tapizado_puerta_tras_der", label: "Tapizado interior de puerta trasera derecha" },
      ],
    },
    {
      title: "Puertas completas",
      items: [
        {
          key: "puerta_completa_del_izq",
          label: "Tapizado interior, cerrajería y cristalería de puerta delantera izquierda",
        },
        {
          key: "puerta_completa_del_der",
          label: "Tapizado interior, cerrajería y cristalería de puerta delantera derecha",
        },
      ],
    },
    {
      title: "Interior",
      items: [
        { key: "cielorraso_interior", label: "Cielorraso interior" },
        { key: "butacas_delanteras", label: "Butacas delanteras" },
        { key: "asientos_traseros", label: "Asientos traseros" },
      ],
    },
    {
      title: "Otros desmontajes",
      items: [
        { key: "radiadores_electroventilador", label: "Conjunto de radiadores y electroventilador" },
        { key: "luneta_termica", label: "Luneta térmica" },
      ],
    },
  ],

  // --- 3.2 DESMONTAR Y REPARAR ---
  DESMONTAR_Y_REPARAR: [
    {
      title: "Paragolpes / Molduras",
      items: [
        { key: "lamina_paragolpe_del", label: "Lámina de paragolpe delantero" },
        { key: "lamina_paragolpe_tras", label: "Lámina de paragolpe trasero" },
        { key: "moldura_paragolpe_del", label: "Moldura plástica de paragolpe delantero" },
        { key: "moldura_paragolpe_tras", label: "Moldura plástica de paragolpe trasero" },
      ],
    },
    {
      title: "Frente y estructura delantera",
      items: [
        { key: "frente_plastico_radiadores", label: "Frente plástico soporte de radiadores" },
        { key: "grilla_frente", label: "Grilla de frente" },
        { key: "marco_opticas_fibra", label: "Marco interior soporte de ópticas (fibra de vidrio)" },
      ],
    },
    {
      title: "Soportes de óptica",
      items: [
        { key: "soporte_optica_izq", label: "Soporte óptica izquierda" },
        { key: "soporte_optica_der", label: "Soporte óptica derecha" },
      ],
    },
    {
      title: "Llantas",
      items: [
        { key: "llanta_del_izq", label: "Llanta delantera izquierda" },
        { key: "llanta_del_der", label: "Llanta delantera derecha" },
        { key: "llanta_tras_izq", label: "Llanta trasera izquierda" },
        { key: "llanta_tras_der", label: "Llanta trasera derecha" },
      ],
    },
  ],

  // --- 3.3 BANCADA DE ESTIRAMIENTO ---
  BANCADA_DE_ESTIRAMIENTO: [
    {
      title: "Estructura delantera",
      items: [
        { key: "escuadrar_frente_carroceria", label: "Escuadrar frente de carrocería" },
        { key: "escuadrar_largueros_falso_chasis_del", label: "Escuadrar largueros falso chasis delantero" },
      ],
    },
    {
      title: "Estructura trasera",
      items: [
        { key: "escuadrar_panel_cola", label: "Escuadrar panel cola de carrocería" },
        { key: "escuadrar_compacto_cola", label: "Escuadrar compacto cola de carrocería" },
      ],
    },
    {
      title: "Parantes delanteros",
      items: [
        { key: "parante_bisagras_del_izq", label: "Escuadrar parante soporte bisagras (puerta delantera izquierda)" },
        { key: "parante_bisagras_del_der", label: "Escuadrar parante soporte bisagras (puerta delantera derecha)" },
      ],
    },
    {
      title: "Parantes centrales",
      items: [
        { key: "parante_central_izq", label: "Escuadrar parante central puertas izquierdas" },
        { key: "parante_central_der", label: "Escuadrar parante central puertas derechas" },
      ],
    },
    {
      title: "Eje",
      items: [{ key: "escuadrar_eje_trasero", label: "Escuadrar y alinear eje trasero" }],
    },
  ],

  // --- 3.4 DESABOLLAR ---
  DESABOLLAR: [
    {
      title: "Guardabarros",
      items: [
        { key: "verificar_costillado", label: "Verificar costillado" },
        { key: "ambos_guardabarros_del", label: "Ambos guardabarros delanteros" },
        { key: "guardabarro_del_izq", label: "Guardabarro delantero izquierdo" },
        { key: "guardabarro_del_der", label: "Guardabarro delantero derecho" },
        { key: "guardabarro_tras_izq", label: "Guardabarro trasero izquierdo" },
        { key: "guardabarro_tras_der", label: "Guardabarro trasero derecho" },
      ],
    },
    {
      title: "Capot",
      items: [
        { key: "capot_motor", label: "Capot motor" },
        { key: "panel_exterior_marco_capot", label: "Panel exterior + marco interior capot" },
      ],
    },
    {
      title: "Frente / Cola",
      items: [
        { key: "frente_carroceria", label: "Frente de carrocería" },
        { key: "panel_cola_carroceria", label: "Panel cola de carrocería" },
        { key: "partes_dañadas_choque", label: "Partes dañadas por el choque (general)" },
      ],
    },
    {
      title: "Portones / Baúl",
      items: [
        { key: "panel_porton_trasero", label: "Panel portón trasero" },
        { key: "marco_interior_porton", label: "Marco interior portón" },
        { key: "porton_caja_carga", label: "Portón caja de carga" },
        { key: "tapa_baul", label: "Tapa de baúl" },
        { key: "piso_baul", label: "Piso de baúl" },
      ],
    },
    {
      title: "Puertas",
      items: [
        { key: "panel_puerta_del_izq", label: "Panel puerta delantera izquierda" },
        { key: "panel_puerta_del_der", label: "Panel puerta delantera derecha" },
        { key: "panel_puerta_tras_izq", label: "Panel puerta trasera izquierda" },
        { key: "panel_puerta_tras_der", label: "Panel puerta trasera derecha" },
      ],
    },
    {
      title: "Laterales / Zócalos / Caja",
      items: [
        { key: "lateral_izq_caja", label: "Lateral izquierdo caja de carga" },
        { key: "lateral_der_caja", label: "Lateral derecho caja de carga" },
        { key: "zocalo_izq", label: "Zócalo izquierdo" },
        { key: "zocalo_der", label: "Zócalo derecho" },
      ],
    },
    {
      title: "Techo",
      items: [{ key: "lamina_techo", label: "Lámina de techo" }],
    },
    {
      title: "Parantes superiores / contorno",
      items: [
        { key: "parante_sup_puertas_izq", label: "Parante superior contorno puertas izq." },
        { key: "parante_sup_puertas_der", label: "Parante superior contorno puertas der." },
        { key: "parante_contorno_parabrisas_izq", label: "Parante contorno parabrisas izq." },
        { key: "parante_contorno_parabrisas_der", label: "Parante contorno parabrisas der." },
      ],
    },
    {
      title: "Parantes traseros",
      items: [
        { key: "parante_tras_izq_cabina", label: "Parante trasero izq. cabina" },
        { key: "parante_tras_der_cabina", label: "Parante trasero der. cabina" },
      ],
    },
    {
      title: "Pasarruedas",
      items: [
        { key: "pasarrueda_tras_izq", label: "Pasarrueda trasero izquierdo" },
        { key: "pasarrueda_tras_der", label: "Pasarrueda trasero derecho" },
      ],
    },
  ],

  // --- 3.5 DESMONTAR Y CAMBIAR ---
  DESMONTAR_Y_CAMBIAR: [
    {
      title: "Paragolpes / Láminas / Grilla",
      items: [
        { key: "cambio_lamina_paragolpe_del", label: "Lámina paragolpe delantero" },
        { key: "cambio_lamina_paragolpe_tras", label: "Lámina paragolpe trasero" },
        { key: "cambio_grilla_central_frente", label: "Grilla central frente" },
        { key: "cambio_tapa_remolque", label: "Tapa remolque" },
      ],
    },
    {
      title: "Ópticas",
      items: [
        { key: "cambio_optica_der", label: "Óptica derecha" },
        { key: "cambio_optica_izq", label: "Óptica izquierda" },
      ],
    },
    {
      title: "Cristales de puertas",
      items: [
        { key: "cristal_del_der", label: "Cristal delantera derecha" },
        { key: "cristal_del_izq", label: "Cristal delantera izquierda" },
        { key: "cristal_tras_der", label: "Cristal trasera derecha" },
        { key: "cristal_tras_izq", label: "Cristal trasera izquierda" },
      ],
    },
    {
      title: "Cristalería general",
      items: [
        { key: "cambio_luneta_termica", label: "Luneta térmica" },
        { key: "cambio_parabrisas_laminado", label: "Parabrisas laminado" },
      ],
    },
    {
      title: "Piezas grandes",
      items: [
        { key: "cambio_capot_motor", label: "Capot motor" },
        { key: "cambio_puerta_del_izq", label: "Puerta delantera izquierda" },
        { key: "cambio_puerta_del_der", label: "Puerta delantera derecha" },
        { key: "cambio_puerta_tras_izq", label: "Puerta trasera izquierda" },
        { key: "cambio_puerta_tras_der", label: "Puerta trasera derecha" },
      ],
    },
    {
      title: "Repuestos detallados externamente",
      items: [{ key: "repuestos_hoja_adjunta", label: "Repuestos que se detallan en hoja adjunta" }],
    },
  ],
};

/** Devuelve el label legible de una key de subdetalle (fallback: la propia key). */
export function subdetailLabel(category: ConceptCategory, key: string): string {
  const groups = SUBDETAILS[category];
  if (!groups) return key;
  for (const g of groups) {
    const hit = g.items.find((i) => i.key === key);
    if (hit) return hit.label;
  }
  return key;
}

// =====================================================
// Totales — cálculo puro (server y client comparten esta función)
// =====================================================

export const DEFAULT_IVA_RATE = 21;

export type ConceptInput = {
  type: ConceptType;
  units?: number | null;
  unitValue?: number | null;
  fixedAmount?: number | null;
};

export type PartInput = {
  quantity: number;
  unitPrice: number;
};

export function computeConceptSubtotal(c: ConceptInput): number {
  if (c.type === "UNIDADES") {
    const u = Number(c.units ?? 0);
    const v = Number(c.unitValue ?? 0);
    return round2(u * v);
  }
  if (c.type === "FIJO") {
    return round2(Number(c.fixedAmount ?? 0));
  }
  return 0; // DESCRIPTIVO no suma
}

export function computePartSubtotal(p: PartInput): number {
  return round2(Number(p.quantity ?? 0) * Number(p.unitPrice ?? 0));
}

export function computeBudgetTotals(opts: {
  concepts: ConceptInput[];
  parts: PartInput[];
  ivaRate?: number;
}) {
  const ivaRate = opts.ivaRate ?? DEFAULT_IVA_RATE;
  const laborSubtotal = round2(
    opts.concepts.reduce((acc, c) => acc + computeConceptSubtotal(c), 0),
  );
  const ivaAmount = round2((laborSubtotal * ivaRate) / 100);
  const laborTotal = round2(laborSubtotal + ivaAmount);
  const partsSubtotal = round2(opts.parts.reduce((acc, p) => acc + computePartSubtotal(p), 0));
  const grandTotal = round2(laborTotal + partsSubtotal);
  return { laborSubtotal, ivaRate, ivaAmount, laborTotal, partsSubtotal, grandTotal };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
