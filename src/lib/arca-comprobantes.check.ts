// Chequeo del lector de Mis Comprobantes: bun src/lib/arca-comprobantes.check.ts
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { importe, leerMisComprobantes, nombreComparable } from "./arca-comprobantes";

const bytes = (b: ArrayBuffer | Uint8Array) =>
  (b instanceof Uint8Array ? b : new Uint8Array(b)).slice().buffer as ArrayBuffer;
const leer = (b: ArrayBuffer | Uint8Array) => {
  const r = leerMisComprobantes(bytes(b));
  if (!r.ok) throw new Error(r.error);
  return r;
};

assert.equal(importe("$ 1.234.567,89"), 1234567.89);
assert.equal(importe("-"), 0);
assert.equal(importe(1500.5), 1500.5);
assert.equal(nombreComparable("Repuestos Sur S.R.L."), nombreComparable("REPUESTOS SUR SRL"));

// Excel con el formato nuevo: título arriba, fecha como fecha de Excel, IVA por alícuota.
const hoja = XLSX.utils.aoa_to_sheet([
  ["Mis Comprobantes Recibidos - CUIT 30712345678"],
  [
    "Fecha de Emisión", "Tipo de Comprobante", "Punto de Venta", "Número Desde", "Número Hasta",
    "Cód. Autorización", "Tipo Doc. Vendedor", "Nro. Doc. Vendedor", "Denominación Vendedor",
    "Tipo Cambio", "Moneda", "Imp. Neto Gravado IVA 10,5%", "IVA 10,5%", "Imp. Neto Gravado IVA 21%",
    "IVA 21%", "Imp. Neto Gravado Total", "Imp. Neto No Gravado", "Imp. Op. Exentas", "Otros Tributos",
    "Total IVA", "Imp. Total",
  ],
  [new Date(2026, 9, 5), "1 - Factura A", 3, 1520, 1520, "76123456789012", 80, "30-71111111-1",
    "REPUESTOS SUR S.R.L.", 1, "$", 1000, 105, 10000, 2100, 11000, 0, 0, 150, 2205, 13355],
  [new Date(2026, 9, 9), "3 - Nota de Crédito A", 3, 88, 88, "76123456789013", 80, "30711111111",
    "REPUESTOS SUR S.R.L.", 1, "$", 0, 0, 1000, 210, 1000, 0, 0, 0, 210, 1210],
  [new Date(2026, 9, 12), "11 - Factura C", 2, 45, 45, "", 80, "20222222223", "Gomería Ruta 70", 1, "PES",
    0, 0, 0, 0, 0, 0, 0, 0, 0, 50000],
  [new Date(2026, 9, 14), "1 - Factura A", 1, 9, 9, "", 80, "30733333334", "Importadora Norte SA", 980.5,
    "DOL", 0, 0, 100, 21, 100, 0, 0, 0, 21, 121],
  [],
  [new Date(2026, 9, 15), "1 - Factura A", 1, 10, 10, "", 80, "", "Sin CUIT", 1, "$", 0, 0, 0, 0, 0, 0, 0, 0, 0, 10],
]);
const libro = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(libro, hoja, "Comprobantes");
const excel = leer(XLSX.write(libro, { type: "array", bookType: "xlsx" }));
assert.equal(excel.comprobantes.length, 4);
assert.deepEqual(excel.errores.map((e) => e.row), [8]);
const [fa, nc, fc, usd] = excel.comprobantes;
assert.equal(fa.date, "2026-10-05");
assert.deepEqual([fa.typeCode, fa.typeName, fa.pointOfSale, fa.number], [1, "Factura A", 3, 1520]);
assert.equal(fa.issuerCuit, "30711111111");
assert.deepEqual([fa.netTaxed, fa.iva, fa.otherTaxes, fa.total], [11000, 2205, 150, 13355]);
assert.deepEqual([nc.netTaxed, nc.iva, nc.total], [-1000, -210, -1210]);
assert.equal(fc.total, 50000);
assert.equal(fc.cae, null);
assert.deepEqual([usd.currency, usd.exchangeRate, usd.total, usd.iva], ["DOL", 980.5, 118640.5, 20590.5]);

// CSV con el formato viejo: separador ";", fechas dd/mm/aaaa, número con punto de venta y en Windows-1252.
const csv = [
  "Fecha;Tipo;Punto de Venta;Número Desde;Número Hasta;Cód. Autorización;Tipo Doc. Emisor;Nro. Doc. Emisor;Denominación Emisor;Tipo Cambio;Moneda;Imp. Neto Gravado;Imp. Neto No Gravado;Imp. Op. Exentas;IVA;Imp. Total",
  "05/09/2026;6 - Factura B;4;77;77;71234567890123;80;30744444445;Pinturería Centro;1;$;8264,46;0;0;1735,54;10000,00",
].join("\r\n");
const cp1252 = Uint8Array.from(csv, (c) => ({ "é": 0xe9, "ó": 0xf3, "í": 0xed })[c] ?? c.charCodeAt(0));
const viejo = leer(cp1252);
assert.equal(viejo.errores.length, 0);
assert.equal(viejo.comprobantes[0].date, "2026-09-05");
assert.equal(viejo.comprobantes[0].issuerName, "Pinturería Centro");
assert.deepEqual([viejo.comprobantes[0].netTaxed, viejo.comprobantes[0].iva, viejo.comprobantes[0].total], [8264.46, 1735.54, 10000]);

// Número junto ("00001-00000106") como en el PDF, y el archivo de emitidos rechazado.
const junto = leer(new TextEncoder().encode(
  "Fecha;Tipo;Número;Nro. Doc. Emisor;Denominación Emisor;Imp. Total\n18/09/2026;11 - Factura C;00001-00000106;20333333334;Taller Eléctrico;345.000,00",
));
assert.deepEqual([junto.comprobantes[0].pointOfSale, junto.comprobantes[0].number, junto.comprobantes[0].total], [1, 106, 345000]);
const emitidos = leerMisComprobantes(bytes(new TextEncoder().encode(
  "Fecha;Tipo;Número;Doc. Receptor;Denominación Receptor;Imp. Total\n18/09/2026;11 - Factura C;00001-00000106;20333333334;Cliente;1",
)));
assert.ok(!emitidos.ok && /emitidos/.test(emitidos.error));
assert.ok(!leerMisComprobantes(bytes(new TextEncoder().encode("hola;chau\n1;2"))).ok);

console.log("arca-comprobantes: ok");
