import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./lib/prisma";
import argon2 from "argon2";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: {
        id: string;
        name: string;
        permissions: Array<{
          permission: {
            name: string;
            description: string;
          };
        }>;
      } | null;
      isActive: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: {
      id: string;
      name: string;
      permissions: Array<{
        permission: {
          name: string;
          description: string;
        };
      }>;
    } | null;
    isActive: boolean;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        try {
          // Find user with role and permissions
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email as string,
              isActive: true,
            },
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

          if (!user) {
            throw new Error("User not found or inactive");
          }

          if (!user.password) {
            throw new Error("User has no password set");
          }

          // Verify password with argon2
          const isValidPassword = await argon2.verify(
            user.password,
            credentials.password as string
          );

          if (!isValidPassword) {
            throw new Error("Invalid password");
          }

          // Check if user has admin or internal role
          if (!user.role || !["admin", "internal"].includes(user.role.name)) {
            throw new Error("Access denied: insufficient permissions");
          }

          return {
            id: user.id,
            email: user.email!,
            name: user.name!,
            role: user.role
              ? {
                  id: user.role.id,
                  name: user.role.name,
                  permissions: user.role.permissions.map((rp) => ({
                    permission: {
                      name: rp.permission.name,
                      description: rp.permission.description || "",
                    },
                  })),
                }
              : null,
            isActive: user.isActive,
          };
        } catch (error) {
          console.error("Auth error:", error);
          throw new Error("Authentication failed");
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isActive = user.isActive;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.isActive = token.isActive as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
});
