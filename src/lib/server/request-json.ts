import "server-only";

export class PayloadTooLargeError extends Error {}

/** Bound actual bytes, including requests without a trustworthy Content-Length. */
export async function requestJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return undefined;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16 * 1024) {
        void reader.cancel().catch(() => undefined);
        throw new PayloadTooLargeError("Request body exceeds 16 KiB");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof PayloadTooLargeError) throw error;
    return undefined;
  } finally { reader.releaseLock(); }
}
