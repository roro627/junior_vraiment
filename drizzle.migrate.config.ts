import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { defineConfig } from "drizzle-kit";

import { readDatabaseEnvironment } from "./src/lib/env";

if (existsSync(".env.local")) {
  loadEnvFile(".env.local");
}

const { DATABASE_DIRECT_URL } = readDatabaseEnvironment();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: DATABASE_DIRECT_URL,
  },
  migrations: {
    schema: "drizzle",
    table: "__drizzle_migrations",
  },
});
