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

interface ResetPasswordProps {
  userName?: string;
  appName?: string;
  resetLink?: string;
}

export function ResetPasswordTemplate({
  userName,
  appName = "Andereggen Taller",
  resetLink,
}: ResetPasswordProps) {
  return (
    <Html>
      <Head />
      <Preview>Restablecer contraseña — {appName}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded my-10 mx-auto p-5 max-w-116.25">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-7.5 mx-0">
              Restablecer contraseña en <strong>{appName}</strong>
            </Heading>

            <Text className="text-black text-[14px] leading-6">
              Hola{userName ? ` ${userName}` : ""},
            </Text>
            <Text className="text-black text-[14px] leading-6">
              Recibimos una solicitud para restablecer la contraseña de tu
              cuenta. Hacé clic en el botón para continuar.
            </Text>

            <Section className="text-center mt-8 mb-8">
              <Button
                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                href={resetLink}
              >
                Restablecer contraseña
              </Button>
            </Section>

            <Text className="text-black text-[14px] leading-6">
              O copiá y pegá este enlace en tu navegador:{" "}
              <Link href={resetLink} className="text-blue-600 no-underline">
                {resetLink}
              </Link>
            </Text>

            <Hr className="border border-solid border-[#eaeaea] my-6 mx-0 w-full" />
            <Text className="text-[#666666] text-[12px] leading-6">
              Este enlace expira en 1 hora. Si no solicitaste restablecer tu
              contraseña, podés ignorar este mensaje. Tu cuenta está segura.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
