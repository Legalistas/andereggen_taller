import { handlers } from "@/auth"; // Referring to the auth.ts we just created

export const { GET, POST } = handlers;

// Ensure we use the Node.js runtime for auth routes to support crypto and database operations
export const runtime = 'nodejs';
