export const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";
export const NODE_ENV = process.env.NODE_ENV as "production" | "development";

/** When true, use Prisma/Supabase for test run persistence; otherwise in-memory. */
export const USE_DATABASE = process.env.USE_DATABASE === "true";
