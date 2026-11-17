// Chequeo de los valores acordados con aseguradoras: bun src/lib/valores-acordados.check.ts
import assert from "node:assert/strict";
import { computeBudgetTotals } from "./budget-catalog";
import { buscarAseguradora, valoresAcordados } from "./valores-acordados";

const lista = [
  {
    name: "El Norte",
    paintPanelPrice: "250000.00",
    sheetDayPrice: "280000.00",
  },
  { name: "Sancor Seguros", paintPanelPrice: 242000, sheetDayPrice: 242000 },
  { name: "La Caja", paintPanelPrice: null, sheetDayPrice: null },
];
const todoRiesgo = (seguro: string) =>
  valoresAcordados(lista, { seguro, cobertura: "todo_riesgo" }, 21);

// Los valores del pedido: final con IVA → valor unitario sin IVA.
assert.deepEqual(todoRiesgo("El Norte"), {
  aseguradora: "El Norte",
  PINTURA: { final: 250000, unitario: 206611.57 },
  CHAPA: { final: 280000, unitario: 231404.96 },
});
assert.deepEqual(todoRiesgo("SANCOR"), {
  aseguradora: "Sancor Seguros",
  PINTURA: { final: 242000, unitario: 200000 },
  CHAPA: { final: 242000, unitario: 200000 },
});

// Solo con todo riesgo, y solo si la aseguradora tiene valores cargados.
assert.equal(
  valoresAcordados(
    lista,
    { seguro: "Sancor Seguros", cobertura: "terceros" },
    21,
  ),
  null,
);
assert.equal(
  valoresAcordados(lista, { seguro: "Sancor Seguros", cobertura: null }, 21),
  null,
);
assert.equal(todoRiesgo("La Caja"), null);
assert.equal(todoRiesgo("Mercantil Andina"), null);

// Seguro del tercero con valores acordados: vale aunque el cliente no tenga todo riesgo.
const conTercero = (v: Partial<Parameters<typeof valoresAcordados>[1]>) =>
  valoresAcordados(
    lista,
    { seguro: "Mercantil Andina", cobertura: "terceros", ...v },
    21,
  )?.aseguradora ?? null;
assert.equal(conTercero({ seguroTercero: "Sancor" }), "Sancor Seguros");
assert.equal(conTercero({ seguroTercero: "El Norte" }), "El Norte");
assert.equal(conTercero({ seguroTercero: "La Caja" }), null);
assert.equal(conTercero({ seguroTercero: "" }), null);
// Si las dos tienen valores, manda el Seguro Responsable (sin definir → el del cliente).
const ambos = {
  seguro: "El Norte",
  cobertura: "todo_riesgo",
  seguroTercero: "Sancor",
};
assert.equal(conTercero(ambos), "El Norte");
assert.equal(conTercero({ ...ambos, responsable: "propio" }), "El Norte");
assert.equal(
  conTercero({ ...ambos, responsable: "tercero" }),
  "Sancor Seguros",
);

// El texto del vehículo es libre: tildes, mayúsculas y nombres incompletos.
assert.equal(buscarAseguradora(lista, "  el norte ")?.name, "El Norte");
assert.equal(buscarAseguradora(lista, "Seguros El Norte")?.name, "El Norte");
assert.equal(buscarAseguradora(lista, "la"), undefined);
assert.equal(buscarAseguradora(lista, ""), undefined);

// Con los valores sin IVA, el total con IVA del presupuesto vuelve al final acordado.
const norte = todoRiesgo("El Norte");
const totales = computeBudgetTotals({
  concepts: [
    { type: "UNIDADES", units: 3, unitValue: norte?.PINTURA?.unitario ?? 0 },
    { type: "UNIDADES", units: 2, unitValue: norte?.CHAPA?.unitario ?? 0 },
  ],
  parts: [],
  ivaRate: 21,
});
assert.equal(totales.laborTotal, 3 * 250000 + 2 * 280000);

console.log("valores-acordados: ok");
