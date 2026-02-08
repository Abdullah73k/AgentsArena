/**
 * Prisma 7 configuration.
 *
 * Bun auto-loads server/.env — no dotenv import needed.
 * Uses DIRECT_URL (port 5432) for CLI operations since the pooler
 * (port 6543 / pgBouncer) does not support migrations or db push.
 */

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"] ?? "",
  },
});
