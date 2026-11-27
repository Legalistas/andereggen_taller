// Chequeo de fechas y alertas de la flota: bun src/lib/fleet.check.ts
import assert from "node:assert/strict";
import {
  addMonths,
  arToday,
  dueStatus,
  fleetAlerts,
  normalizePlate,
  parsePayment,
} from "./fleet";

assert.equal(normalizePlate(" ab 123-cd "), "AB123CD");

// Fin de mes no desborda al mes siguiente.
assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
assert.equal(addMonths("2026-11-15", 2), "2027-01-15");
assert.equal(addMonths("2026-12-31", 12), "2027-12-31");

// 01:00 UTC del 28/11 sigue siendo 27/11 en Argentina.
assert.equal(arToday(new Date("2026-11-28T01:00:00Z")), "2026-11-27");

const today = "2026-11-27";
assert.equal(dueStatus("2026-11-26", null, today), "VENCIDO");
assert.equal(dueStatus("2026-12-12", null, today), "POR_VENCER");
assert.equal(dueStatus("2026-12-13", null, today), "PENDIENTE");
assert.equal(dueStatus("2026-11-01", "2026-11-01", today), "PAGADO");

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const alerts = fleetAlerts(
  [
    {
      id: "v1",
      plate: "AB123CD",
      obligations: [
        {
          type: "SEGURO",
          provider: "La Segunda",
          validUntil: d("2027-06-01"), // lejos: sin aviso
          payments: [
            { dueDate: d("2026-11-20"), paidAt: null }, // vencida
            { dueDate: d("2026-11-10"), paidAt: d("2026-11-10") }, // pagada
            { dueDate: d("2027-01-10"), paidAt: null }, // lejos
          ],
        },
        {
          type: "VTV",
          provider: null,
          validUntil: d("2026-12-05"),
          payments: [],
        },
      ],
      maintenance: [
        // El service viejo avisaba, pero ya se hizo uno nuevo.
        { kind: "SERVICE", date: d("2026-05-01"), nextDate: d("2026-11-01") },
        { kind: "SERVICE", date: d("2026-11-02"), nextDate: d("2027-05-02") },
      ],
    },
  ],
  today,
);
assert.deepEqual(
  alerts.map((a) => [a.label, a.date, a.overdue]),
  [
    ["Pago de Seguro (La Segunda)", "2026-11-20", true],
    ["Vence VTV", "2026-12-05", false],
  ],
);

// Validación: al crear, la fecha es obligatoria; en un PATCH puede no venir.
assert.throws(() => parsePayment({ amount: 100 }, true));
assert.equal(parsePayment({ amount: 100 }, false).dueDate, undefined);
assert.throws(() => parsePayment({ dueDate: "27/11/2026" }, false));
assert.throws(() => parsePayment({ amount: -5 }, false));

console.log("fleet.check OK");
