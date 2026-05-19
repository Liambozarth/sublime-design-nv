import path from "path";
import * as dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local first (highest precedence for local development),
// then .env (committed defaults if any). Existing process.env values
// — set by Vercel in production — take precedence over both, because
// dotenv.config() does not overwrite already-defined env vars.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

export default defineConfig({
  schema: path.join(__dirname, "prisma/schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
