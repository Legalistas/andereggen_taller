/**
 * Email de los avisos automáticos al cliente (y a perito / productor en los
 * eventos que los incluyen). Textos de "Requerimientos de automatizaciones
 * v1.3" (secciones 4 y 5); los definitivos los redacta Marketing.
 *
 * Recipient role: "customer" | "inspector" | "insurance" — los eventos que
 * solo van al cliente no tienen copy para los otros roles.
 */

import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export type RepairEventType =
  // CRM (sección 4)
  | "lead_created" // C1 · se crea la oportunidad
  | "lead_reinforcement" // C3 · Refuerzo 1, al pasar a Refuerzo
  | "lead_reinforcement_2" // C4 · manual desde la oportunidad
  | "lead_reinforcement_3" // C4 · manual desde la oportunidad
  | "lead_won" // C5
  | "lead_lost" // C6
  | "budget_created"
  // Producción (sección 5)
  | "turn_assigned" // P1
  | "parts_pending" // P2
  | "vehicle_entered" // P3
  | "paint_started" // P4
  | "polish_started" // P5
  | "quality_check" // P6 · entró a Calidad, todavía NO está listo (bug B3)
  | "delivery_appointment" // P7 · se cargó el Turno de entrega
  | "customer_experience";

/** Eventos del registro de avisos: los del mail más C2, que sale solo por WhatsApp. */
export type NotifyEvent = RepairEventType | "budget_sent";

export type Role = "customer" | "inspector" | "insurance";

/** Día y hora ya formateados en hora argentina. */
export type DayTime = { day: string; time: string };

type Props = {
  event: RepairEventType;
  role: Role;
  recipientName?: string | null;
  customerName: string;
  /** "Marca Modelo Año · PATENTE"; vacío si la oportunidad no tiene vehículo. */
  vehicleSummary: string;
  /** Para evento budget_created: número y total */
  budgetNumber?: number;
  budgetTotal?: string;
  /** URL de encuesta para customer_experience */
  surveyUrl?: string;
  /** P1 · turno asignado */
  turnAt?: DayTime;
  /** P7 · turno de entrega */
  deliveryAt?: DayTime;
  taller: { name: string; phone: string; email: string };
};

type Copy = { heading: string; intro: (p: Props) => string };

const vehicle = (p: Props) =>
  p.vehicleSummary ? `tu vehículo ${p.vehicleSummary}` : "tu vehículo";

const COPY: Record<
  RepairEventType,
  { customer: Copy; inspector?: Copy; insurance?: Copy }
> = {
  lead_created: {
    customer: {
      heading: "Recibimos tu solicitud de cotización",
      intro: () =>
        "Recibimos tu solicitud de cotización. Ya estamos trabajando y en breve te enviamos el presupuesto a tu correo.",
    },
  },
  // Refuerzos 1 y 2: mismo texto que las plantillas taller_refuerzo1/2 de
  // WhatsApp (los mensajes que mandaba Lu a mano).
  lead_reinforcement: {
    customer: {
      heading: "¿Pudo revisar el presupuesto?",
      intro: (p) =>
        `Le escribimos de ${p.taller.name} por el presupuesto que le enviamos para su auto. ¿Pudo revisarlo? Si quiere avanzar con la reparación, con gusto le reservamos un turno. Cualquier duda que tenga, estamos para ayudarle. ¡Muchas gracias!`,
    },
  },
  lead_reinforcement_2: {
    customer: {
      heading: "¿Sigue interesado/a en la reparación?",
      intro: () =>
        "Le volvemos a escribir para consultarle si sigue interesado/a en la reparación de su auto. Si ya no necesita el servicio, no hay ningún problema: nos ayuda mucho saberlo para mantener nuestra agenda al día. Y si quiere avanzar, avísenos y coordinamos un turno. ¡Gracias por tenernos en cuenta!",
    },
  },
  // Texto provisorio: todavía no hay plantilla taller_refuerzo3.
  lead_reinforcement_3: {
    customer: {
      heading: "¿Seguís interesado en la reparación?",
      intro: (p) =>
        `Queríamos saber si seguís interesado en reparar ${vehicle(p)} con nosotros. Si querés avanzar, respondé este correo y coordinamos el turno.`,
    },
  },
  lead_won: {
    customer: {
      heading: "¡Gracias por elegirnos!",
      intro: (p) =>
        `Gracias por elegir ${p.taller.name} para la reparación de ${vehicle(p)}. En breve te contactamos para coordinar el turno.`,
    },
  },
  lead_lost: {
    customer: {
      heading: "Seguimos a disposición",
      intro: (p) =>
        `Lamentamos que no hayas decidido avanzar. Seguimos a disposición para cualquier consulta sobre tu vehículo en ${p.taller.name}.`,
    },
  },
  budget_created: {
    customer: {
      heading: "Tu presupuesto está listo",
      intro: (p) =>
        `Generamos el presupuesto #${p.budgetNumber ?? "—"} para ${vehicle(p)}. En las próximas horas te llega el detalle por mail con el PDF adjunto.`,
    },
    inspector: {
      heading: "Nuevo presupuesto generado",
      intro: (p) =>
        `Se generó un presupuesto #${p.budgetNumber ?? "—"} para el cliente ${p.customerName} (${p.vehicleSummary}). Quedás notificado para tu revisión.`,
    },
    insurance: {
      heading: "Nuevo presupuesto generado",
      intro: (p) =>
        `Se generó el presupuesto #${p.budgetNumber ?? "—"} del cliente ${p.customerName} (${p.vehicleSummary}) que está en tu cartera.`,
    },
  },
  turn_assigned: {
    customer: {
      heading: "Turno agendado",
      intro: (p) =>
        p.turnAt
          ? `Agendamos tu turno para el ${p.turnAt.day} a las ${p.turnAt.time}. Te esperamos con ${vehicle(p)}.`
          : `Agendamos el turno para ${vehicle(p)}. Te esperamos en la fecha acordada.`,
    },
    inspector: {
      heading: "Turno confirmado",
      intro: (p) =>
        `Se coordinó turno con ${p.customerName} para el vehículo ${p.vehicleSummary}${p.turnAt ? ` (${p.turnAt.day} a las ${p.turnAt.time})` : ""}.`,
    },
    insurance: {
      heading: "Turno confirmado",
      intro: (p) =>
        `Se coordinó turno con ${p.customerName} para el vehículo ${p.vehicleSummary}${p.turnAt ? ` (${p.turnAt.day} a las ${p.turnAt.time})` : ""}.`,
    },
  },
  parts_pending: {
    customer: {
      heading: "Estamos esperando tus repuestos",
      intro: (p) =>
        `Estamos esperando que nos envíen los repuestos de ${vehicle(p)}. Lo seguimos de cerca, pero esta demora no depende del taller.`,
    },
  },
  vehicle_entered: {
    customer: {
      heading: "Tu vehículo ingresó al taller",
      intro: (p) =>
        `Gracias por dejar ${vehicle(p)} en ${p.taller.name}. Quedate tranquilo: tu auto está en manos de expertos y ya ingresó a chapa.`,
    },
    insurance: {
      heading: "Vehículo ingresado al taller",
      intro: (p) =>
        `El vehículo ${p.vehicleSummary} del cliente ${p.customerName} ingresó al taller. Inicio formal del proceso de reparación.`,
    },
  },
  paint_started: {
    customer: {
      heading: "Tu auto pasó a pintura",
      intro: (p) => `${capitalize(vehicle(p))} ya pasó a pintura.`,
    },
  },
  polish_started: {
    customer: {
      heading: "Tu auto pasó a pulido y armado",
      intro: (p) => `${capitalize(vehicle(p))} ya pasó a pulido y armado.`,
    },
  },
  quality_check: {
    customer: {
      heading: "Tu auto entró a calidad",
      intro: (p) =>
        `${capitalize(vehicle(p))} entró a calidad, la última etapa del proceso. Cuando esté listo para retirar te vamos a avisar para que lo vengas a buscar.`,
    },
    inspector: {
      heading: "Vehículo en control de calidad",
      intro: (p) =>
        `El vehículo ${p.vehicleSummary} (cliente: ${p.customerName}) entró a control de calidad, la última etapa de la reparación.`,
    },
    insurance: {
      heading: "Vehículo en control de calidad",
      intro: (p) =>
        `El vehículo ${p.vehicleSummary} del cliente ${p.customerName} entró a control de calidad, la última etapa de la reparación.`,
    },
  },
  delivery_appointment: {
    customer: {
      heading: "Turno para retirar tu auto",
      intro: (p) =>
        p.deliveryAt
          ? `${capitalize(vehicle(p))} va a estar listo para retirar el ${p.deliveryAt.day} a partir de las ${p.deliveryAt.time}. Te esperamos después de ese horario.`
          : `${capitalize(vehicle(p))} ya tiene turno para retirar.`,
    },
  },
  customer_experience: {
    customer: {
      heading: "¿Cómo fue tu experiencia?",
      intro: () =>
        "Nos gustaría conocer tu experiencia con la reparación. Te llevamos solo 1 minuto: respondé esta breve encuesta para ayudarnos a mejorar.",
    },
  },
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Copy del rol; los eventos solo-cliente caen al del cliente. */
function copyFor(event: RepairEventType, role: Role): Copy {
  return COPY[event][role] ?? COPY[event].customer;
}

/** Asunto del mail = título del aviso para ese destinatario. */
export function eventSubject(event: RepairEventType, role: Role): string {
  return copyFor(event, role).heading;
}

/** Ficha de reseñas del taller en Google — destino del mail de experiencia. */
const GOOGLE_REVIEW_URL = "https://g.page/r/CTFP06m9KOcsEAE/review";

export function RepairEventEmail(props: Props) {
  const copy = copyFor(props.event, props.role);
  const greeting = props.recipientName
    ? `Hola ${props.recipientName},`
    : "Hola,";
  const preview = `${copy.heading} — ${props.taller.name}`;

  return (
    <EmailLayout preview={preview}>
      <Heading as="h2" className="text-xl font-bold text-slate-900 m-0">
        {copy.heading}
      </Heading>
      <Text className="text-slate-500 text-xs m-0 mt-1">{greeting}</Text>

      <Text className="text-slate-700 text-sm m-0 mt-3">
        {copy.intro(props)}
      </Text>

      {props.event === "budget_created" && props.budgetTotal ? (
        <Section className="mt-4 p-4 bg-[#003b73]/5 border border-[#003b73]/20 rounded">
          <Text className="text-[10px] uppercase tracking-wider text-slate-500 m-0">
            Total del presupuesto
          </Text>
          <Text className="text-2xl font-bold text-[#003b73] m-0 mt-1">
            {props.budgetTotal}
          </Text>
        </Section>
      ) : null}

      {props.event === "customer_experience" ? (
        <Section className="mt-5">
          <Button
            href={GOOGLE_REVIEW_URL}
            className="bg-[#003b73] text-white text-xs font-semibold px-5 py-3 rounded no-underline"
          >
            Danos tu opinión en Google
          </Button>
        </Section>
      ) : null}

      <Text className="text-slate-500 text-xs m-0 mt-5 leading-relaxed">
        Cualquier duda, respondé este correo o contactanos al{" "}
        <strong>{props.taller.phone}</strong>.
      </Text>
    </EmailLayout>
  );
}
