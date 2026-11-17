/**
 * Valores acordados con las aseguradoras (Configuración → Seguros): el
 * presupuesto propone el valor unitario de Pintura (por paño) y de Chapa (por
 * día) cuando paga una de esas compañías, sea la del cliente (con todo
 * riesgo) o la del tercero. En la aseguradora se cargan finales, con IVA; el
 * valor unitario del presupuesto va sin IVA.
 */

export type AseguradoraConValores = {
  name: string;
  paintPanelPrice?: number | string | null;
  sheetDayPrice?: number | string | null;
};

export type ValorAcordado = { final: number; unitario: number };

export type ValoresAcordados = {
  aseguradora: string;
  PINTURA?: ValorAcordado;
  CHAPA?: ValorAcordado;
};

const comparable = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * La aseguradora del vehículo en la lista. El seguro del vehículo es texto
 * libre: "Sancor" encuentra a "Sancor Seguros".
 */
export function buscarAseguradora<T extends { name: string }>(
  lista: T[],
  seguro: string | null | undefined,
): T | undefined {
  const s = comparable(seguro ?? "");
  if (!s) return undefined;
  return (
    lista.find((a) => comparable(a.name) === s) ??
    // Coincidencia parcial solo con nombres de 4 letras o más ("la" no es "La Caja").
    (s.length >= 4
      ? lista.find((a) => {
          const n = comparable(a.name);
          return n.includes(s) || s.includes(n);
        })
      : undefined)
  );
}

export function valoresAcordados(
  lista: AseguradoraConValores[],
  vehiculo: {
    seguro: string | null | undefined;
    cobertura: string | null | undefined;
    seguroTercero?: string | null;
    /** Seguro Responsable del lead: "propio" | "tercero" | "particular". */
    responsable?: string | null;
  },
  ivaRate: number,
): ValoresAcordados | null {
  const valor = (
    x: number | string | null | undefined,
  ): ValorAcordado | undefined => {
    const final = Number(x);
    if (!(final > 0)) return undefined;
    return {
      final,
      unitario: Math.round((final / (1 + ivaRate / 100)) * 100) / 100,
    };
  };
  const de = (seguro: string | null | undefined): ValoresAcordados | null => {
    const a = buscarAseguradora(lista, seguro);
    if (!a) return null;
    const r = {
      aseguradora: a.name,
      PINTURA: valor(a.paintPanelPrice),
      CHAPA: valor(a.sheetDayPrice),
    };
    return r.PINTURA || r.CHAPA ? r : null;
  };
  // El seguro del cliente paga solo con todo riesgo; el del tercero, siempre.
  const propio =
    vehiculo.cobertura === "todo_riesgo" ? de(vehiculo.seguro) : null;
  const tercero = de(vehiculo.seguroTercero);
  // Si los dos tienen valores acordados, manda el Seguro Responsable.
  return vehiculo.responsable === "tercero"
    ? (tercero ?? propio)
    : (propio ?? tercero);
}
