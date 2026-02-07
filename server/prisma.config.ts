/**
 * Prisma configuration.
 *
 * Load server/.env explicitly so DATABASE_URL and DIRECT_URL are used
 * regardless of where the Prisma CLI is run from (cwd may be repo root).
 */
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "prisma/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use direct connection for CLI (migrate, db push). Supabase pooler does not support migrations.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]!,
    directUrl: process.env["DIRECT_URL"],
  },
});
