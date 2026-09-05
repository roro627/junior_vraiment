import type { NeonQueryFunction } from "@neondatabase/serverless";

import {
  TECHNOLOGY_RULES,
  TECHNOLOGY_TAXONOMY_VERSION,
} from "@/domain/classification/technology-registry";

export async function syncTechnologyTaxonomy(
  sql: NeonQueryFunction<false, false>,
): Promise<void> {
  const technologies = JSON.stringify(
    TECHNOLOGY_RULES.map((technology) => ({
      slug: technology.id,
      label: technology.label,
      // The baseline has no stable category field yet.
      category: "uncategorized",
    })),
  );
  const aliases = JSON.stringify(
    TECHNOLOGY_RULES.flatMap((technology) => [
      ...technology.aliases.map((alias) => ({
        slug: technology.id,
        alias,
        match_kind: "word",
        negative_patterns: technology.exclusions ?? [],
      })),
      ...(technology.contextRequiredAliases ?? []).map((alias) => ({
        slug: technology.id,
        alias,
        match_kind: "regex",
        negative_patterns: technology.exclusions ?? [],
      })),
      ...(technology.caseSensitiveAliases ?? []).map((alias) => ({
        slug: technology.id,
        alias,
        match_kind: "case_sensitive",
        negative_patterns: technology.exclusions ?? [],
      })),
    ]),
  );

  await sql`
    insert into technologies (slug, label, category, taxonomy_version, enabled)
    select
      item.slug,
      item.label,
      item.category,
      ${TECHNOLOGY_TAXONOMY_VERSION},
      true
    from jsonb_to_recordset(${technologies}::jsonb) as item(
      slug text,
      label text,
      category text
    )
    on conflict (slug, taxonomy_version) do update set
      label = excluded.label,
      category = excluded.category,
      enabled = true
  `;

  await sql`
    insert into technology_aliases (
      technology_id,
      alias,
      match_kind,
      negative_patterns
    )
    select
      technology.id,
      item.alias,
      item.match_kind,
      item.negative_patterns
    from jsonb_to_recordset(${aliases}::jsonb) as item(
      slug text,
      alias text,
      match_kind text,
      negative_patterns text[]
    )
    join technologies technology
      on technology.slug = item.slug
      and technology.taxonomy_version = ${TECHNOLOGY_TAXONOMY_VERSION}
    on conflict (technology_id, alias, match_kind) do update set
      negative_patterns = excluded.negative_patterns
  `;
}
