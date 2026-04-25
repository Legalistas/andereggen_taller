import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import {
  admin,
  bearer,
  customSession,
  emailOTP,
  jwt,
  lastLoginMethod,
  multiSession,
  oneTap,
  twoFactor,
} from "better-auth/plugins";
import { sendAuthEmail } from "./email/auth";
import { prisma } from "./prisma";

const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const authOptions = {
  appName: "Andereggen Taller",
  baseURL: BASE_URL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      try {
        await sendAuthEmail({
          to: user.email,
          template: "verify-email",
          variables: {
            verificationUrl: url,
            userName: user.name,
            expirationMinutes: "60",
          },
        });
      } catch (err) {
        console.error("[auth] sendVerificationEmail falló:", err);
      }
    },
  },
  account: {
    accountLinking: {
      trustedProviders: ["email-password", "google"],
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }) {
      try {
        await sendAuthEmail({
          to: user.email,
          template: "reset-password",
          variables: {
            userName: user.name,
            resetLink: url,
          },
        });
      } catch (err) {
        console.error("[auth] sendResetPassword falló:", err);
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  plugins: [
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          try {
            await sendAuthEmail({
              to: user.email,
              template: "two-factor",
              variables: {
                otpCode: otp,
                userName: user.name,
              },
            });
          } catch (err) {
            console.error("[auth] twoFactor.sendOTP falló:", err);
          }
        },
      },
    }),
    bearer(),
    admin({
      schema: {
        user: {
          fields: {
            role: "adminRole",
          },
        },
      },
    }),
    multiSession(),
    nextCookies(),
    oneTap(),
    lastLoginMethod(),
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        try {
          await sendAuthEmail({
            to: email,
            template: "two-factor",
            variables: {
              otpCode: otp,
              userName: "",
            },
          });
        } catch (err) {
          console.error("[auth] emailOTP.sendVerificationOTP falló:", err);
          throw err;
        }
      },
      expiresIn: 600,
    }),
    jwt({
      jwt: {
        issuer: BASE_URL,
      },
    }),
  ],
  trustedOrigins: [BASE_URL],
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...authOptions,
  plugins: [
    ...(authOptions.plugins ?? []),
    customSession(
      async ({ user, session }) => {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        });

        return {
          user: {
            ...user,
            isActive: dbUser?.isActive ?? true,
            domainRole: dbUser?.role
              ? {
                  id: dbUser.role.id,
                  name: dbUser.role.name,
                  label: dbUser.role.label,
                  type: dbUser.role.type,
                  permissions: dbUser.role.permissions.map((rp) => ({
                    permission: {
                      name: rp.permission.name,
                      description: rp.permission.description ?? "",
                    },
                  })),
                }
              : null,
          },
          session,
        };
      },
      authOptions,
      { shouldMutateListDeviceSessionsEndpoint: true },
    ),
  ],
});

export type Session = typeof auth.$Infer.Session;
