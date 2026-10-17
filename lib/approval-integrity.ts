/** Canonical JSON byte encoding and SHA-256 approval seal checks. */
export function toCanonicalBytes(payload: unknown): Uint8Array {
  const seen = new Set<object>();
  const encode = (value: unknown): string => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("Approval payload contains a non-finite number.");
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      if (seen.has(value)) throw new Error("Approval payload must not contain circular references.");
      seen.add(value);
      const encoded = `[${value.map(encode).join(",")}]`;
      seen.delete(value);
      return encoded;
    }
    if (typeof value === "object" && value !== null) {
      if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
        throw new Error("Approval payload must contain plain JSON objects only.");
      }
      if (seen.has(value)) throw new Error("Approval payload must not contain circular references.");
      seen.add(value);
      const record = value as Record<string, unknown>;
      const encoded = `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => {
        return `${JSON.stringify(key)}:${encode(record[key])}`;
      }).join(",")}}`;
      seen.delete(value);
      return encoded;
    }
    throw new Error("Approval payload must be JSON-compatible.");
  };
  return new TextEncoder().encode(encode(payload));
}

export async function createApprovalSeal(payload: unknown): Promise<string> {
  const bytes = toCanonicalBytes(payload);
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input.buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function assertApprovalIntegrity(payload: unknown, seal: string | null | undefined): Promise<void> {
  if (typeof seal !== "string" || !/^[a-f0-9]{64}$/.test(seal)) {
    throw new Error("A valid SHA-256 approval seal is required.");
  }
  if (await createApprovalSeal(payload) !== seal) {
    throw new Error("Approval integrity check failed; content or evidence changed after approval.");
  }
}
