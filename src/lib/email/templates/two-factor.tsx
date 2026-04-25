import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface TwoFactorProps {
  userName?: string;
  appName?: string;
  otpCode?: string;
}

export function TwoFactorTemplate({
  userName,
  appName = "Andereggen Taller",
  otpCode,
}: TwoFactorProps) {
  return (
    <Html>
      <Head />
      <Preview>Tu código de verificación — {appName}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded my-10 mx-auto p-5 max-w-116.25">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-7.5 mx-0">
              Código de verificación
            </Heading>

            <Text className="text-black text-[14px] leading-6">
              Hola{userName ? ` ${userName}` : ""},
            </Text>
            <Text className="text-black text-[14px] leading-6">
              Tu código de verificación de dos pasos para{" "}
              <strong>{appName}</strong> es:
            </Text>

            <Section className="text-center mt-8 mb-8">
              <Text className="text-[#000000] text-[48px] font-bold tracking-[12px] text-center m-0">
                {otpCode}
              </Text>
            </Section>

            <Hr className="border border-solid border-[#eaeaea] my-6.5 mx-0 w-full" />
            <Text className="text-[#666666] text-[12px] leading-6">
              Este código expira en 10 minutos. No lo compartas con nadie. Si no
              solicitaste este código, ignorá este mensaje.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
