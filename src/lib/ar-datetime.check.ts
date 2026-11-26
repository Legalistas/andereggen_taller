// Chequeo de la hora argentina de los turnos: bun src/lib/ar-datetime.check.ts
import assert from "node:assert/strict";
import {
  arDateTimeInputToIso,
  arTomorrowRange,
  isoToArDateTimeInput,
} from "./ar-datetime";

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

// Recordatorio de turnos: el cron de las 10 (13 UTC) del 25/11 busca el 26/11.
const tomorrow = arTomorrowRange(new Date("2026-11-25T13:00:00.000Z"));
assert.equal(tomorrow.from.toISOString(), "2026-11-26T03:00:00.000Z");
assert.equal(tomorrow.to.toISOString(), "2026-11-27T03:00:00.000Z");
// 22:30 del 25/11 en Argentina ya es 26/11 en UTC: igual "mañana" es el 26/11.
assert.equal(
  arTomorrowRange(new Date("2026-11-26T01:30:00.000Z")).from.toISOString(),
  "2026-11-26T03:00:00.000Z",
);

console.log("ar-datetime OK");
