import {
  adminClient,
  customSessionClient,
  emailOTPClient,
  lastLoginMethodClient,
  multiSessionClient,
  oneTapClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { toast } from "sonner";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/auth/two-factor";
      },
    }),
    adminClient(),
    multiSessionClient(),
    oneTapClient({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
      promptOptions: {
        maxAttempts: 1,
      },
    }),
    emailOTPClient(),
    customSessionClient<typeof auth>(),
    lastLoginMethodClient(),
  ],
  fetchOptions: {
    onError(e) {
      if (e.error.status === 429) {
        toast.error(
          "Demasiadas solicitudes. Intentalo de nuevo en un momento.",
        );
      }
    },
  },
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
  twoFactor,
  emailOtp,
  multiSession,
  oneTap,
} = authClient;
