// Importe sin IVA por línea de facturación: bun src/lib/invoice-line.check.ts
import assert from "node:assert/strict";
import { netOfIva } from "./invoice-line";

assert.equal(netOfIva(121_000, "LINEA_1"), 100_000);
assert.equal(netOfIva(50_000, "LINEA_2"), 50_000);

console.log("invoice-line.check OK");
