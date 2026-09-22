import { Buffer } from "node:buffer";

export class BodyTooLargeError extends Error {
  override name = "BodyTooLargeError";
}

export async function readBoundedBody(
  request: Request,
  maximumBytes: number,
): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return new TextDecoder().decode(Buffer.concat(chunks, size));
      size += value.byteLength;
      if (size > maximumBytes) {
        // A hostile producer must not delay rejection through its cancel hook.
        void reader.cancel().catch(() => undefined);
        throw new BodyTooLargeError();
      }
      if (value.byteLength > 0) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}
