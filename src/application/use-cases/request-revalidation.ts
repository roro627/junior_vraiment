import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const STATIC_REVALIDATION_TAGS = new Set([
  "overview",
  "trends",
  "offers",
  "taxonomies",
  "data-status",
]);
const DYNAMIC_REVALIDATION_TAG =
  /^(?:insight|metric|area|job|tech):[a-z0-9][a-z0-9._-]{0,99}$/;

export const REVALIDATION_SIGNATURE_HEADER = "x-revalidation-signature";
export const REVALIDATION_MAX_AGE_MS = 5 * 60 * 1_000;
export const REVALIDATION_MAX_BODY_BYTES = 16 * 1_024;

export function isAllowedRevalidationTag(tag: string): boolean {
  return (
    STATIC_REVALIDATION_TAGS.has(tag) || DYNAMIC_REVALIDATION_TAG.test(tag)
  );
}

const revalidationTagSchema = z
  .string()
  .min(1)
  .max(256)
  .refine(isAllowedRevalidationTag, "Tag de cache non autorisé.");

export const revalidationRequestSchema = z
  .object({
    datasetVersion: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:+-]*$/),
    tags: z
      .array(revalidationTagSchema)
      .min(1)
      .max(32)
      .refine((tags) => new Set(tags).size === tags.length, {
        message: "Les tags doivent être uniques.",
      }),
    timestamp: z.iso.datetime({ offset: true }),
  })
  .strict();

export const revalidationResponseSchema = z
  .object({
    revalidated: z.literal(true),
    tagCount: z.number().int().positive(),
  })
  .strict();

export type RevalidationRequest = z.infer<typeof revalidationRequestSchema>;
export type RevalidationResponse = z.infer<typeof revalidationResponseSchema>;

export function createRevalidationSignature(
  secret: string,
  rawBody: string,
): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

export function hasValidRevalidationSignature(input: {
  secret: string;
  rawBody: string;
  providedSignature: string | null;
}): boolean {
  const expected = createRevalidationSignature(input.secret, input.rawBody);
  const provided = input.providedSignature;

  if (!provided || !/^sha256=[a-f0-9]{64}$/.test(provided)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function isFreshRevalidationTimestamp(
  timestamp: string,
  now: Date = new Date(),
): boolean {
  const timestampMs = Date.parse(timestamp);

  return (
    Number.isFinite(timestampMs) &&
    Math.abs(now.getTime() - timestampMs) <= REVALIDATION_MAX_AGE_MS
  );
}

export class RevalidationRequestError extends Error {
  constructor(readonly status: number) {
    super(`La revalidation a échoué avec le statut ${status}.`);
    this.name = "RevalidationRequestError";
  }
}

type RequestRevalidationInput = {
  url: string;
  secret: string;
  datasetVersion: string;
  tags: string[];
  now?: Date;
  fetcher?: typeof fetch;
};

export async function requestRevalidation({
  url,
  secret,
  datasetVersion,
  tags,
  now = new Date(),
  fetcher = fetch,
}: RequestRevalidationInput): Promise<RevalidationResponse> {
  const target = new URL(url);

  if (target.protocol !== "https:" && target.hostname !== "localhost") {
    throw new TypeError("La revalidation distante exige HTTPS.");
  }

  const payload = revalidationRequestSchema.parse({
    datasetVersion,
    tags,
    timestamp: now.toISOString(),
  });
  const rawBody = JSON.stringify(payload);
  const response = await fetcher(target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [REVALIDATION_SIGNATURE_HEADER]: createRevalidationSignature(
        secret,
        rawBody,
      ),
    },
    body: rawBody,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new RevalidationRequestError(response.status);
  }

  return revalidationResponseSchema.parse(await response.json());
}
