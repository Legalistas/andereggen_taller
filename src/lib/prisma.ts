import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

// Load environment variables safely
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (error) {
    // dotenv not available or already loaded
    console.warn('Warning: dotenv could not be loaded:', error);
  }
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });

let prisma: PrismaClient;

// Singleton pattern for Prisma Client
if (typeof globalThis !== 'undefined') {
  if (!(globalThis as any).prisma) {
    (globalThis as any).prisma = new PrismaClient({ adapter });
  }
  prisma = (globalThis as any).prisma;
} else {
  prisma = new PrismaClient({ adapter });
}

export { prisma };
