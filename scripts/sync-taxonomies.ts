import { neon } from "@neondatabase/serverless";

import { TECHNOLOGY_TAXONOMY_VERSION } from "../src/domain/classification/technology-registry";
import { syncTechnologyTaxonomy } from "../src/db/sync-taxonomies";
import { readDatabaseEnvironment } from "../src/lib/env";

const database = readDatabaseEnvironment();
const sql = neon(database.DATABASE_URL);

await syncTechnologyTaxonomy(sql);

const [row] = await sql`
  select
    count(distinct technology.id)::integer as "technologyCount",
    count(alias.id)::integer as "aliasCount"
  from technologies technology
  left join technology_aliases alias on alias.technology_id = technology.id
  where technology.taxonomy_version = ${TECHNOLOGY_TAXONOMY_VERSION}
`;

process.stdout.write(`${JSON.stringify(row ?? null, null, 2)}\n`);
