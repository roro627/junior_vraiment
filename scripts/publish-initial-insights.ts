import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { neon } from "@neondatabase/serverless";

import { publishInitialInsights } from "../src/db/publish-initial-insights";
import { readDatabaseEnvironment } from "../src/lib/env";

if (existsSync(".env.local")) {
  loadEnvFile(".env.local");
}

const sql = neon(readDatabaseEnvironment().DATABASE_URL);
const result = await publishInitialInsights(sql, new Date());

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
