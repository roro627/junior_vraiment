import { Buffer } from "node:buffer";

import { revalidateTag } from "next/cache";

import {
  hasValidRevalidationSignature,
  isFreshRevalidationTimestamp,
  REVALIDATION_MAX_BODY_BYTES,
  REVALIDATION_SIGNATURE_HEADER,
  revalidationRequestSchema,
} from "@/application/use-cases/request-revalidation";
import { readRevalidationEnvironment } from "@/lib/env";
import { writeOperationalAudit } from "@/lib/operational-audit";

const RESPONSE_HEADERS = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
};

function problem(status: number, code: string): Response {
  return Response.json({ error: code }, { status, headers: RESPONSE_HEADERS });
}

export async function POST(request: Request): Promise<Response> {
  const declaredLength = Number(request.headers.get("content-length"));

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > REVALIDATION_MAX_BODY_BYTES
  ) {
    return problem(413, "payload_too_large");
  }

  const rawBody = await request.text();

  if (Buffer.byteLength(rawBody, "utf8") > REVALIDATION_MAX_BODY_BYTES) {
    return problem(413, "payload_too_large");
  }

  const { REVALIDATION_SECRET } = readRevalidationEnvironment();

  if (
    !hasValidRevalidationSignature({
      secret: REVALIDATION_SECRET,
      rawBody,
      providedSignature: request.headers.get(REVALIDATION_SIGNATURE_HEADER),
    })
  ) {
    return problem(401, "unauthorized");
  }

  let input: unknown;

  try {
    input = JSON.parse(rawBody);
  } catch {
    return problem(400, "invalid_payload");
  }

  const parsed = revalidationRequestSchema.safeParse(input);

  if (!parsed.success) {
    return problem(400, "invalid_payload");
  }

  if (!isFreshRevalidationTimestamp(parsed.data.timestamp)) {
    return problem(401, "expired_request");
  }

  for (const tag of parsed.data.tags) {
    revalidateTag(tag, { expire: 0 });
  }

  writeOperationalAudit({
    event: "revalidation_completed",
    datasetVersion: parsed.data.datasetVersion,
    tagCount: parsed.data.tags.length,
    occurredAt: new Date().toISOString(),
  });

  return Response.json(
    { revalidated: true, tagCount: parsed.data.tags.length },
    { headers: RESPONSE_HEADERS },
  );
}
