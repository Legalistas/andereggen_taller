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

/**
 * Eventos del registro de avisos: los del mail más los que salen solo por
 * WhatsApp (C2 y el recordatorio 24 hs antes del turno de ingreso).
 */
export type NotifyEvent = RepairEventType | "budget_sent" | "turn_reminder";

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

/** Dirección del taller, como en las plantillas de turno de WhatsApp. */
const ADDRESS = "Aconcagua 663, Rafaela";

const vehicle = (p: Props) =>
  p.vehicleSummary ? `tu vehículo ${p.vehicleSummary}` : "tu vehículo";

const COPY: Record<
  RepairEventType,
  { customer: Copy; inspector?: Copy; insurance?: Copy }
> = {
  // Los textos al cliente son los de las plantillas de WhatsApp (taller_…),
  // sin emojis: el saludo con el nombre ({{1}}) ya lo pone el mail.
  lead_created: {
    customer: {
      heading: "Recibimos su solicitud de presupuesto",
      intro: (p) =>
        `Gracias por comunicarse con ${p.taller.name}. Recibimos su solicitud de presupuesto y ya estamos trabajando en ella. En breve se lo enviamos por correo electrónico. Ante cualquier consulta, estamos a disposición.`,
    },
  },
  lead_reinforcement: {
    customer: {
      heading: "¿Pudo ver el presupuesto?",
      intro: (p) =>
        `Queríamos saber si pudo ver el presupuesto que le enviamos por correo para la reparación de su vehículo. Si tiene alguna consulta sobre los trabajos, los plazos o la forma de pago, escríbanos y lo ayudamos. ¡Saludos del equipo de ${p.taller.name}!`,
    },
  },
  lead_reinforcement_2: {
    customer: {
      heading: "¿Pudo revisar el presupuesto?",
      intro: (p) =>
        `Le escribimos de ${p.taller.name} por el presupuesto que le enviamos para su auto. ¿Pudo revisarlo? Si quiere avanzar con la reparación, con gusto le reservamos un turno. Cualquier duda que tenga, estamos para ayudarle. ¡Muchas gracias!`,
    },
  },
  lead_reinforcement_3: {
    customer: {
      heading: "¿Sigue interesado/a en la reparación?",
      intro: () =>
        "Le volvemos a escribir para consultarle si sigue interesado/a en la reparación de su auto. Si ya no necesita el servicio, no hay ningún problema: nos ayuda mucho saberlo para mantener nuestra agenda al día. Y si quiere avanzar, avísenos y coordinamos un turno. ¡Gracias por tenernos en cuenta!",
    },
  },
  lead_won: {
    customer: {
      heading: "Su presupuesto quedó aprobado",
      intro: (p) =>
        `Gracias por confiar en ${p.taller.name}. Su presupuesto quedó aprobado: en breve nos comunicamos con usted para coordinar el turno de ingreso de su vehículo. Ante cualquier consulta, estamos a disposición.`,
    },
  },
  lead_lost: {
    customer: {
      heading: "Gracias por avisarnos",
      intro: (p) =>
        `Gracias por avisarnos y por haber considerado a ${p.taller.name} para la reparación de su vehículo. Registramos su decisión. Si más adelante necesita un nuevo presupuesto o tiene cualquier consulta, estamos a disposición. ¡Que tenga un excelente día!`,
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
        `Agendamos un turno para ${vehicle(p)}${p.turnAt ? ` el ${p.turnAt.day} a las ${p.turnAt.time} hs` : ""}, en ${ADDRESS}. Le recomendamos retirar del vehículo todos los objetos de valor que puedan dañarse o extraviarse durante la reparación. Si al dejar el auto necesita que lo alcancemos a su domicilio o a otro lugar dentro de Rafaela, avísenos y lo organizamos sin costo. Si tiene algún viaje o imprevisto, escríbanos con anticipación y reprogramamos el turno. ¡Lo esperamos!`,
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
      heading: "Estamos esperando los repuestos",
      intro: () =>
        "Le contamos que estamos esperando la llegada de los repuestos para la reparación de su vehículo. Esta demora no depende del taller: apenas los recibamos, nos comunicamos con usted para coordinar el turno. ¡Gracias por su paciencia y comprensión!",
    },
  },
  vehicle_entered: {
    customer: {
      heading: "Su vehículo ingresó al taller",
      intro: () =>
        "Su vehículo ya ingresó a nuestro taller y comenzamos con los trabajos de chapa. Puede seguir el avance de la reparación en todo momento desde Mi reparación: tallerandereggen.ar/estado. Le vamos a ir avisando en cada etapa. ¡Gracias por confiar en nosotros!",
    },
    insurance: {
      heading: "Vehículo ingresado al taller",
      intro: (p) =>
        `El vehículo ${p.vehicleSummary} del cliente ${p.customerName} ingresó al taller. Inicio formal del proceso de reparación.`,
    },
  },
  paint_started: {
    customer: {
      heading: "Su vehículo pasó a pintura",
      intro: () =>
        "Buenas noticias: su vehículo terminó la etapa de chapa y ya pasó a pintura. Trabajamos con pinturas originales Glasurit en nuestra cabina de pintura, para que el color quede idéntico al de fábrica. ¡Seguimos avanzando! Le avisamos cuando pase a la siguiente etapa.",
    },
  },
  polish_started: {
    customer: {
      heading: "Su vehículo pasó a pulido y armado",
      intro: () =>
        "Su vehículo salió de pintura y ya está en pulido y armado. Estamos en la recta final de la reparación: le avisamos apenas pase a control de calidad. ¡Gracias por su paciencia!",
    },
  },
  quality_check: {
    customer: {
      // B3: todavía NO está listo para retirar.
      heading: "Su vehículo entró a control de calidad",
      intro: () =>
        "Su vehículo entró en la última etapa del proceso: el control de calidad. Revisamos cada detalle para entregárselo en perfectas condiciones. Cuando esté listo, le asignaremos un turno de retiro. ¡Ya falta muy poco!",
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
      heading: "¡Su vehículo está listo!",
      intro: (p) =>
        `Le asignamos el siguiente turno de retiro${p.deliveryAt ? `: ${p.deliveryAt.day} a las ${p.deliveryAt.time} hs` : ""}, en ${ADDRESS}. Si la reparación fue a través de su seguro, recuerde abonar el importe de la franquicia al momento del retiro. Si no puede venir en ese horario, avísenos y lo reprogramamos. ¡Lo esperamos!`,
    },
  },
  customer_experience: {
    customer: {
      heading: "¿Cómo fue su experiencia?",
      intro: (p) =>
        `Queremos agradecerle por confiar en ${p.taller.name} para la reparación de su vehículo. Nos ayudaría muchísimo que nos deje una breve reseña en Google contando cómo fue su experiencia. Puede ser algo simple, por ejemplo: cómo lo atendimos, cómo quedó su vehículo o si nos recomendaría a otra persona. ¡Muchas gracias!`,
    },
  },
};

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
