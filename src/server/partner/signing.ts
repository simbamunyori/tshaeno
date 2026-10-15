import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * How a partner signs a request, and how Tshaeno checks it. The same
 * scheme as Thebe's partner API, so one adapter in the partner's console
 * serves both; only the header prefix and base address differ. The
 * partner sends:
 *
 *   X-Tshaeno-Key:        its key id
 *   X-Tshaeno-Timestamp:  seconds since 1970, within 5 minutes of now
 *   X-Tshaeno-Signature:  v1=<hex HMAC-SHA256 of the string below, keyed with its secret>
 *
 * The signed string is the timestamp, the method, the path with its
 * query, and the SHA-256 of the body, joined by newlines. A copied
 * request can't be replayed later, sent to another path, or changed.
 */

export const MAX_SKEW_SECONDS = 300;

export function sha256Hex(body: string | Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

export function signedString(timestamp: string, method: string, path: string, body: string): string {
  return [timestamp, method.toUpperCase(), path, sha256Hex(body)].join("\n");
}

export function sign(secret: string, timestamp: string, method: string, path: string, body: string): string {
  return `v1=${createHmac("sha256", secret).update(signedString(timestamp, method, path, body)).digest("hex")}`;
}

export function signatureMatches(secret: string, given: string, timestamp: string, method: string, path: string, body: string): boolean {
  const expected = Buffer.from(sign(secret, timestamp, method, path, body));
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function timestampFresh(timestamp: string, now: Date): boolean {
  if (!/^\d{9,11}$/.test(timestamp)) return false;
  return Math.abs(now.getTime() / 1000 - Number(timestamp)) <= MAX_SKEW_SECONDS;
}

export function newKeyId(): string {
  return `pk_${randomBytes(9).toString("hex")}`;
}

export function newSecret(): string {
  return `ps_${randomBytes(32).toString("base64url")}`;
}
