// Chequeo de la hora argentina de los turnos: bun src/lib/ar-datetime.check.ts
import assert from "node:assert/strict";
import { arDateTimeInputToIso, isoToArDateTimeInput } from "./ar-datetime";

// El caso del bug B2: turno del jueves 26/11 a las 14:30 (hora argentina).
assert.equal(
  arDateTimeInputToIso("2026-11-26T14:30"),
  "2026-11-26T17:30:00.000Z",
);
assert.equal(
  isoToArDateTimeInput("2026-11-26T17:30:00.000Z"),
  "2026-11-26T14:30",
);

// Pasada la medianoche UTC sigue siendo el mismo día en Argentina.
assert.equal(
  isoToArDateTimeInput("2026-11-27T01:15:00.000Z"),
  "2026-11-26T22:15",
);
assert.equal(
  arDateTimeInputToIso("2026-11-26T22:15"),
  "2026-11-27T01:15:00.000Z",
);

assert.equal(isoToArDateTimeInput(null), "");

console.log("ar-datetime OK");
