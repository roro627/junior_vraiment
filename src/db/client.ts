import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { readDatabaseEnvironment } from "@/lib/env";

import * as schema from "./schema";

export function createDatabase() {
  const { DATABASE_URL } = readDatabaseEnvironment();
  const client = neon(DATABASE_URL);

  return drizzle({ client, schema });
}

export type Database = ReturnType<typeof createDatabase>;
