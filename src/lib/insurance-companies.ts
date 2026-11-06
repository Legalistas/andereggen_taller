/**
 * Valores acordados de una aseguradora que llegan en el body (ver
 * `InsuranceCompany.paintPanelPrice` / `sheetDayPrice`): número ≥ 0, o
 * null / "" para sacarlo. Los que no vienen no se tocan.
 */
export function leerPreciosAcordados(body: {
  paintPanelPrice: unknown;
  sheetDayPrice: unknown;
}):
  | { data: { paintPanelPrice?: number | null; sheetDayPrice?: number | null } }
  | { error: string } {
  const data: {
    paintPanelPrice?: number | null;
    sheetDayPrice?: number | null;
  } = {};
  for (const campo of ["paintPanelPrice", "sheetDayPrice"] as const) {
    const v = body[campo];
    if (v === undefined) continue;
    if (v === null || v === "") {
      data[campo] = null;
      continue;
    }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1e12) {
      return { error: "Valor acordado inválido" };
    }
    data[campo] = Math.round(n * 100) / 100;
  }
  return { data };
}
