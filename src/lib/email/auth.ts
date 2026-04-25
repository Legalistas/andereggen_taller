import { sendEmail } from "./send";
import { ResetPasswordTemplate } from "./templates/reset-password";
import { TwoFactorTemplate } from "./templates/two-factor";
import { VerifyEmailTemplate } from "./templates/verify-email";

const APP_NAME = "Andereggen Taller";

type AuthTemplate = "verify-email" | "reset-password" | "two-factor";

interface AuthEmailVars {
  verificationUrl?: string;
  verificationCode?: string;
  expirationMinutes?: string;
  resetLink?: string;
  otpCode?: string;
  userName?: string;
}

export interface SendAuthEmailOptions {
  to: string;
  template: AuthTemplate;
  variables: AuthEmailVars;
}

export async function sendAuthEmail({
  to,
  template,
  variables,
}: SendAuthEmailOptions): Promise<void> {
  switch (template) {
    case "verify-email":
      await sendEmail({
        to,
        subject: `Verificá tu correo — ${APP_NAME}`,
        react: VerifyEmailTemplate({
          userName: variables.userName,
          appName: APP_NAME,
          verificationUrl: variables.verificationUrl,
          verificationCode: variables.verificationCode,
          expirationMinutes: variables.expirationMinutes,
        }),
      });
      return;

    case "reset-password":
      await sendEmail({
        to,
        subject: `Restablecer contraseña — ${APP_NAME}`,
        react: ResetPasswordTemplate({
          userName: variables.userName,
          appName: APP_NAME,
          resetLink: variables.resetLink,
        }),
      });
      return;

    case "two-factor":
      await sendEmail({
        to,
        subject: `Código de verificación — ${APP_NAME}`,
        react: TwoFactorTemplate({
          userName: variables.userName,
          appName: APP_NAME,
          otpCode: variables.otpCode,
        }),
      });
      return;
  }
}
