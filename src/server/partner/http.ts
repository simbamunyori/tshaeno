import type { Partner, Prisma, PrismaClient } from "@prisma/client";
import { asSystem } from "@/server/db";
import { env } from "@/server/env";
import { partnerSecret, PartnerError } from "./service";
import { sha256Hex, signatureMatches, timestampFresh } from "./signing";

/**
 * Every partner API route goes through here: it checks the signature,
 * the time and the caller's address, makes a retried change return the
 * first answer instead of happening twice, and logs every call.
 */

export type PartnerHandler = (partner: Partner, body: unknown) => Promise<{ status?: number; data: unknown; organisationId?: string | null }>;

const CHANGES = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function json(status: number, data: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

function problem(status: number, code: string, message: string, details?: unknown) {
  return json(status, { error: { code, message, ...(details ? { details } : {}) } });
}

export interface PartnerRouteOptions {
  db?: PrismaClient;
  encryptionKey?: string;
  now?: Date;
}

export async function partnerRoute(req: Request, handler: PartnerHandler, opts: PartnerRouteOptions = {}): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname + url.search;
  const method = req.method.toUpperCase();
  const raw = await req.text();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const keyId = req.headers.get("x-tshaeno-key") ?? "";
  const timestamp = req.headers.get("x-tshaeno-timestamp") ?? "";
  const signature = req.headers.get("x-tshaeno-signature") ?? "";
  const idempotencyKey = req.headers.get("idempotency-key")?.trim() || null;
  const now = opts.now ?? new Date();
  const sys = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => asSystem(fn, opts.db);

  const partner = keyId && keyId.length < 100 ? await sys((tx) => tx.partner.findUnique({ where: { keyId } })) : null;
  // Unknown keys are not logged: there's no partner to log them against.
  if (!partner || !partner.active) return problem(401, "unauthorised", "Unknown or disabled key.");

  const log = (status: number, response: unknown, organisationId: string | null = null, key: string | null = null) =>
    sys((tx) =>
      tx.partnerRequest.create({
        data: {
          partnerId: partner.id,
          idempotencyKey: key,
          method,
          path: path.slice(0, 500),
          bodySha256: sha256Hex(raw),
          ipAddress: ip,
          status,
          response: response as Prisma.InputJsonValue,
          targetOrganisationId: organisationId,
        },
      }),
    );
  const refuse = async (status: number, code: string, message: string) => {
    await log(status, { error: { code, message } });
    return problem(status, code, message);
  };
  const earlierFor = (key: string) => sys((tx) => tx.partnerRequest.findUnique({ where: { partnerId_idempotencyKey: { partnerId: partner.id, idempotencyKey: key } } }));

  if (partner.allowedIps.length && (!ip || !partner.allowedIps.includes(ip))) return refuse(403, "address_not_allowed", "Requests from this address aren't allowed.");
  if (!timestampFresh(timestamp, now)) return refuse(401, "stale", "X-Tshaeno-Timestamp is missing or more than 5 minutes from now.");
  if (!signatureMatches(partnerSecret(partner, opts.encryptionKey ?? env().TOTP_ENCRYPTION_KEY), signature, timestamp, method, path, raw)) {
    return refuse(401, "bad_signature", "The signature doesn't match.");
  }

  const changes = CHANGES.has(method);
  if (changes && !idempotencyKey) return refuse(400, "idempotency_key_required", "Send an Idempotency-Key header with every change.");
  if (idempotencyKey && idempotencyKey.length > 200) return refuse(400, "invalid", "Idempotency-Key is too long.");

  if (changes && idempotencyKey) {
    const earlier = await earlierFor(idempotencyKey);
    if (earlier) {
      if (earlier.method !== method || earlier.path !== path || earlier.bodySha256 !== sha256Hex(raw)) {
        return problem(422, "idempotency_key_reused", "This Idempotency-Key was used for a different request.");
      }
      return json(earlier.status, earlier.response, { "Idempotent-Replayed": "true" });
    }
  }

  let body: unknown = undefined;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      return refuse(400, "invalid_json", "The body isn't valid JSON.");
    }
  }

  let status: number;
  let data: unknown;
  let organisationId: string | null = null;
  try {
    const r = await handler(partner, body);
    status = r.status ?? 200;
    data = r.data;
    organisationId = r.organisationId ?? (data && typeof data === "object" && "id" in data ? String((data as { id: unknown }).id) : null);
  } catch (e) {
    if (!(e instanceof PartnerError)) {
      console.error("Partner API failed", e);
      // Not stored against the key, so the partner can retry once the fault is fixed.
      await log(500, { error: { code: "server_error" } });
      return problem(500, "server_error", "Something went wrong at Tshaeno. Retry with the same Idempotency-Key.");
    }
    status = e.status;
    data = { error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } };
  }
  try {
    await log(status, data, organisationId, changes ? idempotencyKey : null);
  } catch (e) {
    // Two copies of the same retry raced: answer with whichever was stored first.
    const earlier = idempotencyKey ? await earlierFor(idempotencyKey) : null;
    if (!earlier) throw e;
    return json(earlier.status, earlier.response, { "Idempotent-Replayed": "true" });
  }
  return json(status, data);
}
