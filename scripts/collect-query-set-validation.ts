import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { readFranceTravailEnvironment } from "../src/lib/env";
import {
  FranceTravailClient,
  type FranceTravailSourcePage,
} from "../src/lib/france-travail/client";
import { FranceTravailError } from "../src/lib/france-travail/errors";
import { normalizeFranceTravailOffer } from "../src/lib/france-travail/normalize";

const MAX_RESULTS = 3150;
const PAGE_SIZE = 150;
const DEFAULT_REQUEST_INTERVAL_MS = 250;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 1_000;
const SAMPLE_PER_GROUP = 30;
const SAMPLE_PER_STRATUM = 10;

const querySetSchema = z
  .strictObject({
    documentVersion: z.string().min(1),
    querySetVersion: z.string().min(1),
    source: z.literal("france-travail"),
    requestRules: z
      .strictObject({
        maxRequestsPerSecondInitial: z.literal(5),
        maxResultsPerRange: z.literal(150),
        maxStartIndex: z.literal(3000),
        maxEndIndex: z.literal(3149),
      })
      .passthrough(),
    groups: z
      .array(
        z.strictObject({
          id: z.string().min(1),
          enabled: z.boolean(),
          jobFamilies: z.array(z.string().min(1)).min(1),
          occupationReferences: z.array(z.string().regex(/^[A-Z]\d{4}$/u)),
          keywordsAny: z.array(z.string().trim().min(2)),
          titleIncludesAny: z.array(z.string().trim().min(2)).optional(),
        }),
      )
      .min(1),
  })
  .passthrough();

export type QuerySet = z.infer<typeof querySetSchema>;
export type AtomicQueryKind = "occupation-only" | "keyword-only" | "overlap";

export type AtomicQuery = {
  id: string;
  codeROME: string | null;
  motsCles: string | null;
  kind: AtomicQueryKind;
  groupIds: string[];
  jobFamilies: string[];
  titleIncludesAnyByGroup: Record<string, string[]>;
};

export type SearchClient = {
  search(parameters: {
    occupationReference?: string;
    keyword?: string;
    rangeStart?: number;
    rangeSize?: number;
  }): Promise<FranceTravailSourcePage>;
};

type QueryRun = {
  query: AtomicQuery;
  total: number | null;
  status: "complete" | "over_cap" | "incomplete" | "probe";
  pages: number;
  rowsReceived: number;
  offerIds: string[];
  warnings: string[];
  quarantined: number;
};

type SeenOffer = {
  externalId: string;
  title: string;
  description: string;
  structuredExperienceRequired: boolean | null;
  structuredExperienceLabel: string | null;
  groupChannels: Map<string, Set<AtomicQueryKind>>;
  groupQueryIds: Map<string, Set<string>>;
};

export type BlindReviewRow = {
  reviewId: string;
  groupId: string;
  jobFamilies: string[];
  title: string;
  description: string;
  structuredExperienceRequired: boolean | null;
  structuredExperienceLabel: string | null;
  discoveryChannels: AtomicQueryKind[];
};

function normalizeSearchText(value: string): string {
  return ` ${value
    .normalize("NFKD")
    .toLocaleLowerCase("fr")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ")} `;
}

export function titleMatchesAny(
  title: string,
  patterns: readonly string[] | undefined,
): boolean {
  if (!patterns || patterns.length === 0) return true;
  const normalizedTitle = normalizeSearchText(title);
  return patterns.some((pattern) =>
    normalizedTitle.includes(normalizeSearchText(pattern)),
  );
}

function reviewIdFor(
  externalId: string,
  groupId: string,
  sampleSeed: string,
): string {
  return stableHash(`${externalId}\u0000${groupId}\u0000${sampleSeed}`).slice(
    0,
    24,
  );
}

function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableCompare<T>(
  left: T,
  right: T,
  value: (item: T) => string,
): number {
  return value(left).localeCompare(value(right), "en");
}

/** Validates the observed query-set document before it can trigger a request. */
export function parseQuerySet(source: unknown): QuerySet {
  return querySetSchema.parse(source);
}

/**
 * Produces the three observable discovery channels. Equal codeROME/keyword
 * combinations are deliberately shared by every group that declares them.
 */
export function buildAtomicQueries(querySet: QuerySet): AtomicQuery[] {
  const byPair = new Map<string, AtomicQuery>();

  const add = (
    group: QuerySet["groups"][number],
    codeROME: string | null,
    motsCles: string | null,
    kind: AtomicQueryKind,
  ): void => {
    const key = `${codeROME ?? ""}\u0000${motsCles ?? ""}`;
    const current = byPair.get(key);
    if (current) {
      current.groupIds = [...new Set([...current.groupIds, group.id])].sort();
      current.jobFamilies = [
        ...new Set([...current.jobFamilies, ...group.jobFamilies]),
      ].sort();
      current.titleIncludesAnyByGroup[group.id] = [
        ...(group.titleIncludesAny ?? []),
      ];
      return;
    }
    byPair.set(key, {
      id: stableHash(key).slice(0, 16),
      codeROME,
      motsCles,
      kind,
      groupIds: [group.id],
      jobFamilies: [...group.jobFamilies].sort(),
      titleIncludesAnyByGroup: {
        [group.id]: [...(group.titleIncludesAny ?? [])],
      },
    });
  };

  for (const group of querySet.groups) {
    for (const codeROME of group.occupationReferences) {
      add(group, codeROME, null, "occupation-only");
    }
    for (const motsCles of group.keywordsAny) {
      add(group, null, motsCles, "keyword-only");
    }
    for (const codeROME of group.occupationReferences) {
      for (const motsCles of group.keywordsAny) {
        add(group, codeROME, motsCles, "overlap");
      }
    }
  }

  return [...byPair.values()].sort((left, right) =>
    stableCompare(left, right, (query) => query.id),
  );
}

export function redactReviewText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/giu, "[URL]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu, "[EMAIL]")
    .replace(/(?:\+33|0)[\d .()-]{8,}/gu, "[TÉLÉPHONE]")
    .trim()
    .slice(0, 2000);
}

function parseRange(value: string): { start: number; end: number } | null {
  const match = /^(\d+)-(\d+)$/u.exec(value);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    end >= start
    ? { start, end }
    : null;
}

function expectedNextRange(start: number, total: number): string | null {
  const nextStart = start + PAGE_SIZE;
  if (nextStart >= total || nextStart > 3000) return null;
  return `${nextStart}-${Math.min(nextStart + PAGE_SIZE - 1, 3149)}`;
}

class RequestLimiter {
  private lastStartedAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly now: () => number,
    private readonly sleep: (milliseconds: number) => Promise<void>,
    private readonly intervalMs: number,
  ) {}

  async wait(): Promise<void> {
    const delay = this.lastStartedAt + this.intervalMs - this.now();
    if (delay > 0) await this.sleep(delay);
    this.lastStartedAt = this.now();
  }
}

export async function collectAtomicQuery(
  client: SearchClient,
  query: AtomicQuery,
  options: {
    probeOnly?: boolean;
    limiter?: { wait(): Promise<void> };
    sleep?: (milliseconds: number) => Promise<void>;
    random?: () => number;
  } = {},
): Promise<{ run: QueryRun; offers: SeenOffer[] }> {
  const warnings: string[] = [];
  const offers: SeenOffer[] = [];
  const offerIds = new Set<string>();
  let rangeStart = 0;
  let expectedTotal: number | null = null;
  let pages = 0;
  let rowsReceived = 0;
  let quarantined = 0;

  const searchWithRetry = async (): Promise<FranceTravailSourcePage> => {
    for (let attempt = 0; ; attempt += 1) {
      await options.limiter?.wait();
      try {
        return await client.search({
          ...(query.codeROME ? { occupationReference: query.codeROME } : {}),
          ...(query.motsCles ? { keyword: query.motsCles } : {}),
          rangeStart,
          rangeSize: options.probeOnly ? 1 : PAGE_SIZE,
        });
      } catch (error) {
        if (
          !(error instanceof FranceTravailError) ||
          !error.retryable ||
          attempt >= MAX_RETRY_ATTEMPTS - 1
        ) {
          throw error;
        }
        const sleep =
          options.sleep ??
          ((milliseconds: number) =>
            new Promise<void>((done) => setTimeout(done, milliseconds)));
        const random = options.random ?? Math.random;
        await sleep(
          RETRY_BASE_DELAY_MS * 2 ** attempt + Math.floor(random() * 250),
        );
      }
    }
  };

  while (true) {
    const page = await searchWithRetry();
    pages += 1;
    rowsReceived += page.items.length + page.quarantined.length;
    quarantined += page.quarantined.length;
    warnings.push(
      ...page.warnings.map(
        (warning) => `unknown_field:${warning.field}:${warning.observedType}`,
      ),
    );
    if (page.quarantined.length > 0) warnings.push("offers_quarantined");
    expectedTotal ??= page.total;
    if (page.total !== expectedTotal) {
      warnings.push("total_changed_during_pagination");
      return {
        run: {
          query,
          total: expectedTotal,
          status: "incomplete",
          pages,
          rowsReceived,
          offerIds: [],
          warnings,
          quarantined,
        },
        offers: [],
      };
    }
    if (page.total > MAX_RESULTS) {
      return {
        run: {
          query,
          total: page.total,
          status: "over_cap",
          pages,
          rowsReceived,
          offerIds: [],
          warnings,
          quarantined,
        },
        offers: [],
      };
    }
    if (options.probeOnly) {
      return {
        run: {
          query,
          total: page.total,
          status: "probe",
          pages,
          rowsReceived,
          offerIds: [],
          warnings,
          quarantined,
        },
        offers: [],
      };
    }

    for (const sourceOffer of page.items) {
      if (offerIds.has(sourceOffer.id)) continue;
      offerIds.add(sourceOffer.id);
      const normalized = normalizeFranceTravailOffer(sourceOffer);
      const acceptedGroupIds = query.groupIds.filter((groupId) =>
        titleMatchesAny(
          normalized.title,
          query.titleIncludesAnyByGroup[groupId],
        ),
      );
      if (acceptedGroupIds.length === 0) continue;
      offers.push({
        externalId: normalized.externalId,
        title: redactReviewText(normalized.title),
        description: redactReviewText(normalized.descriptionText),
        structuredExperienceRequired: normalized.structuredExperience.required,
        structuredExperienceLabel: normalized.structuredExperience.label,
        groupChannels: new Map(
          acceptedGroupIds.map((groupId) => [groupId, new Set([query.kind])]),
        ),
        groupQueryIds: new Map(
          acceptedGroupIds.map((groupId) => [groupId, new Set([query.id])]),
        ),
      });
    }

    const expected = expectedNextRange(rangeStart, page.total);
    if (page.nextRange !== expected) {
      warnings.push("next_range_invalid");
      return {
        run: {
          query,
          total: page.total,
          status: "incomplete",
          pages,
          rowsReceived,
          offerIds: [...offerIds].sort(),
          warnings,
          quarantined,
        },
        offers,
      };
    }
    if (!expected) {
      if (rowsReceived !== page.total) {
        warnings.push("received_row_count_mismatch");
      }
      return {
        run: {
          query,
          total: page.total,
          status:
            rowsReceived === page.total && quarantined === 0
              ? "complete"
              : "incomplete",
          pages,
          rowsReceived,
          offerIds: [...offerIds].sort(),
          warnings,
          quarantined,
        },
        offers,
      };
    }
    const next = parseRange(expected);
    if (!next || next.start <= rangeStart) {
      warnings.push("pagination_progression_invalid");
      return {
        run: {
          query,
          total: page.total,
          status: "incomplete",
          pages,
          rowsReceived,
          offerIds: [...offerIds].sort(),
          warnings,
          quarantined,
        },
        offers,
      };
    }
    rangeStart = next.start;
  }
}

export function buildBlindSample(
  groups: QuerySet["groups"],
  offers: ReadonlyMap<string, SeenOffer>,
  sampleSeed = "legacy",
): BlindReviewRow[] {
  const rows: BlindReviewRow[] = [];
  for (const group of groups) {
    const candidates = [...offers.values()]
      .filter((offer) => offer.groupChannels.has(group.id))
      .map((offer) => {
        const discoveryChannels = [
          ...(offer.groupChannels.get(group.id) ?? []),
        ].sort();
        const stratum = discoveryChannels.includes("overlap")
          ? "overlap"
          : discoveryChannels.includes("keyword-only") &&
              !discoveryChannels.includes("occupation-only")
            ? "keyword-only"
            : "occupation-only";
        return {
          offer,
          discoveryChannels,
          stratum,
          hash: stableHash(
            `${offer.externalId}\u0000${group.id}\u0000${sampleSeed}`,
          ),
        };
      })
      .sort((left, right) => left.hash.localeCompare(right.hash));
    const selected = new Set<string>();
    for (const stratum of [
      "keyword-only",
      "occupation-only",
      "overlap",
    ] as const) {
      for (const candidate of candidates
        .filter((item) => item.stratum === stratum)
        .slice(0, SAMPLE_PER_STRATUM)) {
        selected.add(candidate.offer.externalId);
      }
    }
    for (const candidate of candidates) {
      if (selected.size >= SAMPLE_PER_GROUP) break;
      selected.add(candidate.offer.externalId);
    }
    for (const candidate of candidates.filter((item) =>
      selected.has(item.offer.externalId),
    )) {
      rows.push({
        reviewId: reviewIdFor(candidate.offer.externalId, group.id, sampleSeed),
        groupId: group.id,
        jobFamilies: [...group.jobFamilies],
        title: candidate.offer.title,
        description: candidate.offer.description,
        structuredExperienceRequired:
          candidate.offer.structuredExperienceRequired,
        structuredExperienceLabel: candidate.offer.structuredExperienceLabel,
        discoveryChannels: candidate.discoveryChannels,
      });
    }
  }
  return rows.sort((left, right) =>
    left.reviewId.localeCompare(right.reviewId),
  );
}

export function calculatePairwiseOverlap(
  runs: QueryRun[],
): Array<Record<string, unknown>> {
  const completeRuns = runs.filter((run) => run.status === "complete");
  return completeRuns.flatMap((left, leftIndex) =>
    completeRuns.slice(leftIndex + 1).map((right) => {
      const leftIds = new Set(left.offerIds);
      const intersection = right.offerIds.filter((id) =>
        leftIds.has(id),
      ).length;
      const union = new Set([...left.offerIds, ...right.offerIds]).size;
      return {
        leftQueryId: left.query.id,
        rightQueryId: right.query.id,
        intersection,
        union,
        jaccard: union === 0 ? null : intersection / union,
      };
    }),
  );
}

async function main(): Promise<void> {
  const probeOnly = process.argv.includes("--probe-only");
  const readArgument = (name: string, fallback: string): string =>
    process.argv
      .find((argument) => argument.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? fallback;
  const sourcePath = resolve(
    readArgument("--query-set", "docs/reference/query-set.observed-draft.json"),
  );
  const sourceContents = await readFile(sourcePath, "utf8");
  const querySet = parseQuerySet(JSON.parse(sourceContents) as unknown);
  const client = new FranceTravailClient(readFranceTravailEnvironment());
  const limiter = new RequestLimiter(
    Date.now,
    (milliseconds) => new Promise((done) => setTimeout(done, milliseconds)),
    DEFAULT_REQUEST_INTERVAL_MS,
  );
  const runs: QueryRun[] = [];
  const offers = new Map<string, SeenOffer>();

  for (const query of buildAtomicQueries(querySet)) {
    const result = await collectAtomicQuery(client, query, {
      probeOnly,
      limiter,
    });
    runs.push(result.run);
    for (const offer of result.offers) {
      const existing = offers.get(offer.externalId);
      if (!existing) {
        offers.set(offer.externalId, offer);
        continue;
      }
      for (const [groupId, channels] of offer.groupChannels) {
        const target =
          existing.groupChannels.get(groupId) ?? new Set<AtomicQueryKind>();
        channels.forEach((channel) => target.add(channel));
        existing.groupChannels.set(groupId, target);
      }
      for (const [groupId, queryIds] of offer.groupQueryIds) {
        const target = existing.groupQueryIds.get(groupId) ?? new Set<string>();
        queryIds.forEach((queryId) => target.add(queryId));
        existing.groupQueryIds.set(groupId, target);
      }
    }
  }

  const outputDirectory = resolve(
    readArgument("--output-directory", ".local/query-set-validation"),
  );
  await mkdir(outputDirectory, { recursive: true });
  const collectedAt = new Date().toISOString();
  const summary = {
    collectedAt,
    mode: probeOnly ? "probe-only" : "full",
    querySetVersion: querySet.querySetVersion,
    sourceSha256: stableHash(sourceContents),
    queryCount: runs.length,
    completeQueries: runs.filter((run) => run.status === "complete").length,
    overCapQueries: runs.filter((run) => run.status === "over_cap").length,
    incompleteQueries: runs.filter((run) => run.status === "incomplete").length,
    totalReported: runs.reduce((sum, run) => sum + (run.total ?? 0), 0),
    uniqueOffers: offers.size,
    quarantined: runs.reduce((sum, run) => sum + run.quarantined, 0),
    warnings: [...new Set(runs.flatMap((run) => run.warnings))].sort(),
    queries: runs.map((run) => ({
      queryId: run.query.id,
      kind: run.query.kind,
      groupIds: run.query.groupIds,
      total: run.total,
      status: run.status,
      pages: run.pages,
      rowsReceived: run.rowsReceived,
      codeROME: run.query.codeROME,
      motsCles: run.query.motsCles,
      warnings: run.warnings,
      quarantined: run.quarantined,
    })),
    overlaps: probeOnly ? [] : calculatePairwiseOverlap(runs),
  };

  await writeFile(
    resolve(outputDirectory, "report.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );
  if (!probeOnly) {
    const redactedCollection = {
      collectedAt,
      querySetVersion: querySet.querySetVersion,
      offers: [...offers.values()].map((offer) => ({
        externalIdHash: stableHash(offer.externalId),
        groups: [...offer.groupChannels.keys()].sort().map((groupId) => ({
          groupId,
          reviewId: reviewIdFor(
            offer.externalId,
            groupId,
            querySet.querySetVersion,
          ),
          channels: [...(offer.groupChannels.get(groupId) ?? [])].sort(),
          queryIds: [...(offer.groupQueryIds.get(groupId) ?? [])].sort(),
        })),
      })),
    };
    await writeFile(
      resolve(outputDirectory, "collection.redacted.json"),
      JSON.stringify(redactedCollection, null, 2),
      "utf8",
    );
    await writeFile(
      resolve(outputDirectory, "blind-sample.json"),
      JSON.stringify(
        {
          collectedAt,
          querySetVersion: querySet.querySetVersion,
          rows: buildBlindSample(
            querySet.groups,
            offers,
            querySet.querySetVersion,
          ),
        },
        null,
        2,
      ),
      "utf8",
    );
  }
  process.stdout.write(
    `${JSON.stringify({
      collectedAt: summary.collectedAt,
      mode: summary.mode,
      querySetVersion: summary.querySetVersion,
      queryCount: summary.queryCount,
      completeQueries: summary.completeQueries,
      overCapQueries: summary.overCapQueries,
      incompleteQueries: summary.incompleteQueries,
      totalReported: summary.totalReported,
      uniqueOffers: summary.uniqueOffers,
      quarantined: summary.quarantined,
      warnings: summary.warnings,
    })}\n`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
