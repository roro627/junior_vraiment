import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { offersSortSchema, type Scope } from "./contracts";

const CURSOR_DOMAIN = "offers-cursor-v1";

const cursorPayloadSchema = z
  .object({
    version: z.literal(1),
    datasetVersion: z.string().min(1).max(100),
    filterHash: z.string().regex(/^[a-f0-9]{64}$/u),
    sort: offersSortSchema,
    offerId: z.string().uuid(),
    primary: z.number().nullable(),
  })
  .strict();

export type OffersCursor = z.infer<typeof cursorPayloadSchema>;

export class InvalidCursorError extends Error {
  override name = "InvalidCursorError";
}

function uuidBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replaceAll("-", ""), "hex");
}

export function publicOfferId(offerId: string): string {
  const parsed = z.string().uuid().parse(offerId);
  return `jv_${uuidBytes(parsed).toString("base64url")}`;
}

export function offersFilterHash(input: {
  scope: Scope;
  classification: string | null;
  salaryPublished: boolean | null;
  experience: string[];
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function cursorSignature(secret: string, payload: string): string {
  return createHmac("sha256", secret)
    .update(CURSOR_DOMAIN)
    .update("\0")
    .update(payload)
    .digest("base64url");
}

export function encodeOffersCursor(
  cursor: OffersCursor,
  secret: string,
): string {
  const payload = Buffer.from(
    JSON.stringify(cursorPayloadSchema.parse(cursor)),
  ).toString("base64url");
  return `${payload}.${cursorSignature(secret, payload)}`;
}

export function decodeOffersCursor(
  encoded: string,
  expected: Pick<OffersCursor, "datasetVersion" | "filterHash" | "sort">,
  secret: string,
): OffersCursor {
  const [payload, providedSignature, extra] = encoded.split(".");
  if (!payload || !providedSignature || extra !== undefined) {
    throw new InvalidCursorError("Le format du curseur est invalide.");
  }
  const expectedSignature = cursorSignature(secret, payload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new InvalidCursorError("La signature du curseur est invalide.");
  }

  try {
    const cursor = cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
    if (
      cursor.datasetVersion !== expected.datasetVersion ||
      cursor.filterHash !== expected.filterHash ||
      cursor.sort !== expected.sort
    ) {
      throw new InvalidCursorError(
        "Le curseur ne correspond pas au dataset ou aux filtres.",
      );
    }
    return cursor;
  } catch (error) {
    if (error instanceof InvalidCursorError) throw error;
    throw new InvalidCursorError("Le contenu du curseur est invalide.");
  }
}
