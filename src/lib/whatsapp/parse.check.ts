// Chequeo de los helpers de WhatsApp: bun src/lib/whatsapp/parse.check.ts
import assert from "node:assert/strict";
import {
  aPlantilla,
  avanzaEstado,
  esBaja,
  parsearLista,
  parseInbound,
  rellenar,
  ventanaAbierta,
  waIdArgentina,
} from "./parse";
import { firmaValida, twilioSignature } from "./signature";

// Teléfonos cargados a mano → 549 + 10 dígitos.
assert.equal(waIdArgentina("+54 9 3492 60-9000"), "5493492609000");
assert.equal(waIdArgentina("03492 15 609000"), "5493492609000");
assert.equal(waIdArgentina("011 15 2705-9000"), "5491127059000");
assert.equal(waIdArgentina("3492609000"), "5493492609000");
assert.equal(waIdArgentina("609000"), null);
assert.equal(waIdArgentina(null), null);

// Webhook entrante.
const inbound = parseInbound({
  MessageSid: "SM1",
  From: "whatsapp:+5493492609000",
  WaId: "5493492609000",
  To: "whatsapp:+5493492702000",
  Body: "Hola",
  NumMedia: "1",
  MediaUrl0: "https://api.twilio.com/m/1",
  MediaContentType0: "image/jpeg",
});
assert.equal(inbound?.waId, "5493492609000");
assert.deepEqual(inbound?.media, [
  { url: "https://api.twilio.com/m/1", contentType: "image/jpeg" },
]);
assert.equal(parseInbound({ From: "x" }), null);
assert.ok(esBaja(" BAJA ") && esBaja("stop.") && !esBaja("dame de baja"));

// Estados: solo avanzan.
assert.ok(avanzaEstado(null, "sent"));
assert.ok(avanzaEstado("sent", "read"));
assert.ok(!avanzaEstado("read", "delivered"));
assert.ok(!avanzaEstado("sent", "raro"));

// Ventana de 24 h.
const now = new Date("2026-11-26T12:00:00Z");
assert.ok(ventanaAbierta(new Date("2026-11-25T13:00:00Z"), now));
assert.ok(!ventanaAbierta(new Date("2026-11-25T11:00:00Z"), now));
assert.ok(!ventanaAbierta(null, now));

// Plantillas: solo las del Taller y aprobadas.
const item = {
  sid: "HX1",
  friendly_name: "taller_turno_asignado",
  variables: { "1": "Juan" },
  types: {
    "twilio/text": { body: "Hola {{1}}, tu turno es el {{3}} a las {{4}}" },
  },
  approval_requests: { status: "approved", category: "UTILITY" },
};
const p = aPlantilla(item);
assert.deepEqual(
  p?.variables.map((v) => v.key),
  ["1", "3", "4"],
);
assert.equal(aPlantilla({ ...item, friendly_name: "legales_aviso" }), null);
assert.equal(
  aPlantilla({ ...item, approval_requests: { status: "pending" } }),
  null,
);
assert.equal(
  rellenar("Hola {{1}}, {{ 2 }} {{9}}", { "1": "Ana", "2": "ok" }),
  "Hola Ana, ok {{9}}",
);

// Lista pegada y CSV de Google Contactos.
const { contactos, invalidos } = parsearLista(
  [
    "Nombre\tTeléfono",
    "Juan Pérez\t3492 15-609000",
    "Ana; 011 15 2705-9000",
    "Pedro Gómez 3492 609000", // repetido: cuenta una vez
    "Raro\t12345678",
    'Lucía,,Martínez,"+54 9 3492 55-1234 ::: +54 9 3492 55-0000"',
  ].join("\n"),
);
assert.deepEqual(
  contactos.map((c) => [c.nombre, c.waId]),
  [
    ["Juan Pérez", "5493492609000"],
    ["Ana", "5491127059000"],
    ["Lucía", "5493492551234"],
  ],
);
assert.deepEqual(invalidos, ["Raro\t12345678"]);

// Firma: vector calculado con twilio.validateRequest de Legalistas.
const params = {
  Body: "Hola",
  From: "whatsapp:+5493492609000",
  MessageSid: "SM1",
};
const url = "https://intra.tallerandereggen.ar/api/whatsapp/webhook/incoming";
const sig = twilioSignature("token123", url, params);
assert.equal(sig, "7hLjRag7JBtMCHbfZn7lj6+zfL8=");
assert.ok(firmaValida("token123", sig, url, params));
assert.ok(!firmaValida("token123", sig, `${url}?x=1`, params));
assert.ok(!firmaValida("otro", sig, url, params));

console.log("whatsapp parse OK");
