import { createHash } from "node:crypto";

type JsonResponseInput = {
  request: Request;
  body: unknown;
  datasetVersion: string;
  cacheControl: string;
};

export function jsonResponseWithEtag({
  request,
  body,
  datasetVersion,
  cacheControl,
}: JsonResponseInput): Response {
  const json = JSON.stringify(body);
  const etag = `"${createHash("sha256")
    .update(datasetVersion)
    .update("\0")
    .update(json)
    .digest("base64url")}"`;
  const headers = {
    "cache-control": cacheControl,
    etag,
  };

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(json, {
    status: 200,
    headers: {
      ...headers,
      "content-type": "application/json; charset=utf-8",
    },
  });
}
