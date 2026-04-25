/**
 * Layout compartido para emails del taller.
 * Wrapper con header (logo/nombre), container y footer con datos de contacto.
 * Cada plantilla concreta importa <EmailLayout preview="...">...</EmailLayout>.
 */

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

const BRAND = {
  name: "Andereggen Taller Automotor",
  address: "Aconcagua 663 — Rafaela, Santa Fe",
  phone: "(03492) 155-90753 / 427211",
  email: "andereggen.taller@gmail.com",
  color: "#003b73",
};

type Props = {
  preview: string;
  children: ReactNode;
};

export function EmailLayout({ preview, children }: Props) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-slate-100 font-sans py-8">
          <Container className="max-w-[560px] bg-white rounded-lg overflow-hidden shadow-sm">
            {/* Header */}
            <Section
              className="px-8 py-6"
              style={{ backgroundColor: BRAND.color }}
            >
              <Text className="text-white text-xl font-bold m-0 leading-tight">
                {BRAND.name}
              </Text>
              <Text className="text-white/80 text-xs m-0 mt-1">
                {BRAND.address}
              </Text>
            </Section>

            {/* Body */}
            <Section className="px-8 py-8 text-slate-800">{children}</Section>

            {/* Footer */}
            <Hr className="my-0 border-slate-200" />
            <Section className="px-8 py-5 bg-slate-50">
              <Text className="text-xs text-slate-500 m-0 leading-relaxed">
                <strong className="text-slate-700">{BRAND.name}</strong>
                <br />
                {BRAND.address}
                <br />
                Tel: {BRAND.phone} — {BRAND.email}
              </Text>
              <Text className="text-[10px] text-slate-400 mt-3 m-0">
                Recibís este correo porque sos cliente del taller. Si creés que
                es un error, respondé este mail.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
