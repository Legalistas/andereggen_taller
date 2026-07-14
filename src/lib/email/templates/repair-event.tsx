/**
 * Email de notificación automática para los eventos de la spec sección 6.
 * Variantes (event):
 *   - "budget_created"        → Presupuesto generado
 *   - "vehicle_entered"       → Vehículo ingresado al taller
 *   - "parts_received"        → Repuestos recibidos
 *   - "repair_completed"      → Reparación completada / listo para retirar
 *   - "customer_experience"   → Solicitud de experiencia del cliente (encuesta)
 *
 * Recipient role: "customer" | "inspector" | "insurance" — adapta el saludo + CTA.
 */

import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./layout";

export type RepairEventType =
  | "budget_created"
  | "vehicle_entered"
  | "parts_received"
  | "repair_completed"
  | "customer_experience"
  | "turn_assigned" // spec 2.1 v2 · Turno coordinado con el cliente
  | "lead_reinforcement"; // spec 1.3 v2 · Lead movido a "Refuerzo"

type Role = "customer" | "inspector" | "insurance";

type Props = {
  event: RepairEventType;
  role: Role;
  recipientName?: string | null;
  customerName: string;
  vehicleSummary: string;
  /** Para evento budget_created: número y total */
  budgetNumber?: number;
  budgetTotal?: string;
  /** URL de encuesta para customer_experience */
  surveyUrl?: string;
  /** Para turn_assigned: fecha/hora del turno formateada en es-AR */
  turnDateFormatted?: string;
  taller: { name: string; phone: string; email: string };
};

const COPY: Record<
  RepairEventType,
  Record<Role, { heading: string; intro: (p: Props) => string; cta?: string }>
> = {
  budget_created: {
    customer: {
      heading: "Tu presupuesto está listo",
      intro: (p) =>
        `Generamos el presupuesto #${p.budgetNumber ?? "—"} para tu vehículo ${p.vehicleSummary}. En las próximas horas te llega el detalle por mail con el PDF adjunto.`,
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
  vehicle_entered: {
    customer: {
      heading: "Tu vehículo ingresó al taller",
      intro: (p) =>
        `Confirmamos que tu vehículo ${p.vehicleSummary} ingresó al taller. Te vamos a ir notificando los avances de la reparación.`,
    },
    inspector: {
      heading: "Vehículo ingresado al taller",
      intro: (p) =>
        `El vehículo ${p.vehicleSummary} del cliente ${p.customerName} ingresó al taller y está en proceso.`,
    },
    insurance: {
      heading: "Vehículo ingresado al taller",
      intro: (p) =>
        `El vehículo ${p.vehicleSummary} del cliente ${p.customerName} ingresó al taller. Inicio formal del proceso de reparación.`,
    },
  },
  parts_received: {
    customer: {
      heading: "Repuestos recibidos",
      intro: (p) =>
        `Llegaron todos los repuestos para tu vehículo ${p.vehicleSummary}. La reparación arranca a la brevedad.`,
    },
    inspector: {
      heading: "Repuestos recibidos",
      intro: (p) =>
        `El taller confirmó la recepción completa de repuestos para ${p.customerName} — ${p.vehicleSummary}. Listo para iniciar producción.`,
    },
    insurance: {
      heading: "Repuestos recibidos",
      intro: (p) =>
        `Confirmamos la recepción de todos los repuestos para el siniestro de ${p.customerName} (${p.vehicleSummary}). Inicia producción.`,
    },
  },
  repair_completed: {
    customer: {
      heading: "Tu vehículo está listo para retirar",
      intro: (p) =>
        `Terminamos la reparación de tu vehículo ${p.vehicleSummary}. Pasó el control de calidad y ya podés coordinar el retiro.`,
      cta: "Coordinar retiro",
    },
    inspector: {
      heading: "Reparación completada",
      intro: (p) =>
        `La reparación del vehículo ${p.vehicleSummary} (cliente: ${p.customerName}) está terminada y aprobada por calidad.`,
    },
    insurance: {
      heading: "Reparación completada",
      intro: (p) =>
        `La reparación del cliente ${p.customerName} — ${p.vehicleSummary} está finalizada. El vehículo queda a disposición para retiro.`,
    },
  },
  customer_experience: {
    customer: {
      heading: "¿Cómo fue tu experiencia?",
      intro: () =>
        "Nos gustaría conocer tu experiencia con la reparación. Te llevamos solo 1 minuto: respondé esta breve encuesta para ayudarnos a mejorar.",
      cta: "Responder encuesta",
    },
    // Inspector y productor no reciben este evento — incluido para satisfacer el tipo
    inspector: {
      heading: "Encuesta enviada al cliente",
      intro: (p) =>
        `Se envió la encuesta de satisfacción al cliente ${p.customerName} por el vehículo ${p.vehicleSummary}.`,
    },
    insurance: {
      heading: "Encuesta enviada al cliente",
      intro: (p) =>
        `Se envió la encuesta de satisfacción al cliente ${p.customerName} (${p.vehicleSummary}).`,
    },
  },
  turn_assigned: {
    customer: {
      heading: "Turno confirmado",
      intro: (p) =>
        p.turnDateFormatted
          ? `Coordinamos tu turno para el ${p.turnDateFormatted}. Te esperamos con tu vehículo ${p.vehicleSummary}.`
          : `Coordinamos el turno para tu vehículo ${p.vehicleSummary}. Te esperamos en la fecha acordada.`,
    },
    inspector: {
      heading: "Turno confirmado",
      intro: (p) =>
        `Se coordinó turno con ${p.customerName} para el vehículo ${p.vehicleSummary}${p.turnDateFormatted ? ` (${p.turnDateFormatted})` : ""}.`,
    },
    insurance: {
      heading: "Turno confirmado",
      intro: (p) =>
        `Se coordinó turno con ${p.customerName} para el vehículo ${p.vehicleSummary}${p.turnDateFormatted ? ` (${p.turnDateFormatted})` : ""}.`,
    },
  },
  lead_reinforcement: {
    customer: {
      heading: "¿Coordinamos tu reparación?",
      intro: (p) =>
        `¿Pudiste ver el presupuesto que te enviamos para tu vehículo ${p.vehicleSummary}? Nos gustaría coordinar un turno para avanzar. Cualquier duda respondé este correo y te ayudamos.`,
    },
    inspector: {
      heading: "Lead en seguimiento",
      intro: (p) =>
        `El lead de ${p.customerName} (${p.vehicleSummary}) pasó a "Refuerzo": mail de seguimiento enviado al cliente.`,
    },
    insurance: {
      heading: "Lead en seguimiento",
      intro: (p) =>
        `El lead de ${p.customerName} (${p.vehicleSummary}) pasó a "Refuerzo".`,
    },
  },
};

export function RepairEventEmail(props: Props) {
  const copy = COPY[props.event][props.role];
  const greeting = props.recipientName
    ? `Hola ${props.recipientName},`
    : "Hola,";
  const preview = `${copy.heading} — ${props.taller.name}`;

  const showSurveyButton =
    props.event === "customer_experience" && props.surveyUrl;
  const showCtaButton =
    !showSurveyButton &&
    copy.cta &&
    props.event === "repair_completed" &&
    props.role === "customer";

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

      {showSurveyButton ? (
        <Section className="mt-5">
          <Button
            href={props.surveyUrl}
            className="bg-[#003b73] text-white text-xs font-semibold px-5 py-3 rounded no-underline"
          >
            {copy.cta ?? "Responder encuesta"}
          </Button>
        </Section>
      ) : null}

      {showCtaButton ? (
        <Section className="mt-5">
          <Button
            href={`tel:${props.taller.phone}`}
            className="bg-[#003b73] text-white text-xs font-semibold px-5 py-3 rounded no-underline"
          >
            {copy.cta ?? "Contactar"}
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
