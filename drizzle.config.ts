import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  migrations: {
    prefix: "timestamp",
    schema: "drizzle",
    table: "__drizzle_migrations",
  },
});
