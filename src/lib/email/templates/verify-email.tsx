import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface VerifyEmailProps {
  userName?: string;
  appName?: string;
  verificationUrl?: string;
  verificationCode?: string;
  expirationMinutes?: string;
}

export function VerifyEmailTemplate({
  userName,
  appName = "Andereggen Taller",
  verificationUrl,
  verificationCode,
  expirationMinutes = "10",
}: VerifyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verificá tu correo en {appName}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded my-10 mx-auto p-5 max-w-116.25">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-7.5 mx-0">
              Verificá tu cuenta en <strong>{appName}</strong>
            </Heading>

            <Text className="text-black text-[14px] leading-6">
              Hola{userName ? ` ${userName}` : ""},
            </Text>
            <Text className="text-black text-[14px] leading-6">
              Gracias por registrarte. Por favor confirmá tu dirección de correo
              electrónico.
            </Text>

            {verificationUrl ? (
              <Section className="text-center mt-8 mb-8">
                <Button
                  className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                  href={verificationUrl}
                >
                  Verificar cuenta
                </Button>
              </Section>
            ) : (
              <Section className="text-center mt-8 mb-8">
                <Text className="text-black text-[14px]">
                  Tu código de verificación es:
                </Text>
                <Text className="text-[#000000] text-[36px] font-bold tracking-[8px] text-center">
                  {verificationCode}
                </Text>
              </Section>
            )}

            {verificationUrl && (
              <Text className="text-black text-[14px] leading-6">
                O copiá y pegá este enlace en tu navegador:{" "}
                <Link
                  href={verificationUrl}
                  className="text-blue-600 no-underline"
                >
                  {verificationUrl}
                </Link>
              </Text>
            )}

            <Hr className="border border-solid border-[#eaeaea] my-6.5 mx-0 w-full" />
            <Text className="text-[#666666] text-[12px] leading-6">
              Este enlace expira en {expirationMinutes} minutos. Si no creaste
              una cuenta en <strong>{appName}</strong>, podés ignorar este
              mensaje.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
