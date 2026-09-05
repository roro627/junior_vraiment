import { neon } from "@neondatabase/serverless";

import { reclassifyCurrentDataset } from "../src/application/ingestion/reclassify-current-dataset";
import { readDatabaseEnvironment } from "../src/lib/env";

const database = readDatabaseEnvironment();
const summary = await reclassifyCurrentDataset({
  sql: neon(database.DATABASE_URL),
  classifiedAt: new Date(),
});

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
