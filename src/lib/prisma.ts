import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.ts";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });

type GlobalWithPrisma = typeof globalThis & { __prisma?: PrismaClient };

// Singleton — evita crear múltiples clientes en dev con HMR.
const globalWithPrisma = globalThis as GlobalWithPrisma;
export const prisma: PrismaClient =
    globalWithPrisma.__prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
    globalWithPrisma.__prisma = prisma;
}
