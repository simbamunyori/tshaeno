import { ProviderError, type Fetch } from "@/server/connections/http";

/**
 * DPO Pay (API v6). We create a payment token for an invoice, send the
 * customer to DPO's payment page, and on their return, or later from the
 * worker, ask DPO whether it was paid. We never see card details.
 */

export interface DpoConfig {
  companyToken: string;
  serviceType: string;
  apiUrl: string;
  payUrl: string;
}

export const DPO_API_URL = "https://secure.3gdirectpay.com/API/v6/";
export const DPO_PAY_URL = "https://secure.3gdirectpay.com/payv2.php";

/** Hours DPO keeps a payment token open. */
const PAYMENT_TIME_LIMIT_HOURS = 48;

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
const unescapeXml = (s: string) =>
  s.replace(/&(lt|gt|amp|apos|quot);/g, (_, e: string) => ({ lt: "<", gt: ">", amp: "&", apos: "'", quot: '"' })[e]!);

/** The text of each top-level tag in DPO's flat XML replies. */
export function readXml(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of xml.matchAll(/<([A-Za-z][\w]*)>([^<]*)<\/\1>/g)) out[m[1]] = unescapeXml(m[2]).trim();
  return out;
}

async function call(cfg: DpoConfig, body: string, f: Fetch): Promise<Record<string, string>> {
  let res: Response;
  try {
    res = await f(cfg.apiUrl, { method: "POST", headers: { "content-type": "application/xml" }, body, signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    throw new ProviderError("unavailable", "Couldn't reach DPO Pay. Try again in a moment.", 0, String(err));
  }
  const text = await res.text();
  if (!res.ok) throw new ProviderError(res.status >= 500 ? "unavailable" : "invalid", "DPO Pay had a problem. Try again in a moment.", res.status, text);
  return readXml(text);
}

export interface PaymentRequest {
  /** Our reference: the invoice number. */
  reference: string;
  amountMinor: number;
  currency: string;
  description: string;
  redirectUrl: string;
  backUrl: string;
  customerEmail?: string;
}

/** Creates a token for this payment. Returns it and the page to send the customer to. */
export async function createPayment(cfg: DpoConfig, p: PaymentRequest, f: Fetch = fetch): Promise<{ token: string; url: string }> {
  const amount = (p.amountMinor / 100).toFixed(2);
  const today = new Date().toISOString().slice(0, 16).replace("T", " ").replace(/-/g, "/");
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
<CompanyToken>${escapeXml(cfg.companyToken)}</CompanyToken>
<Request>createToken</Request>
<Transaction>
<PaymentAmount>${amount}</PaymentAmount>
<PaymentCurrency>${escapeXml(p.currency)}</PaymentCurrency>
<CompanyRef>${escapeXml(p.reference)}</CompanyRef>
<RedirectURL>${escapeXml(p.redirectUrl)}</RedirectURL>
<BackURL>${escapeXml(p.backUrl)}</BackURL>
<CompanyRefUnique>0</CompanyRefUnique>
<PTL>${PAYMENT_TIME_LIMIT_HOURS}</PTL>${p.customerEmail ? `\n<customerEmail>${escapeXml(p.customerEmail)}</customerEmail>` : ""}
</Transaction>
<Services>
<Service>
<ServiceType>${escapeXml(cfg.serviceType)}</ServiceType>
<ServiceDescription>${escapeXml(p.description)}</ServiceDescription>
<ServiceDate>${today}</ServiceDate>
</Service>
</Services>
</API3G>`;
  const r = await call(cfg, xml, f);
  if (r.Result !== "000" || !r.TransToken) {
    throw new ProviderError("invalid", "DPO Pay couldn't start this payment. Try again, or pay by bank transfer.", 0, `${r.Result ?? ""} ${r.ResultExplanation ?? ""}`);
  }
  return { token: r.TransToken, url: `${cfg.payUrl}?ID=${encodeURIComponent(r.TransToken)}` };
}

export type PaymentState =
  | { state: "paid"; reference: string; amountMinor: number; currency: string }
  | { state: "waiting" }
  | { state: "failed"; reason: string };

/** DPO's codes for a payment that is under way but not finished. */
const WAITING = new Set(["001", "003", "007", "900"]);

/** Asks DPO whether this token's payment went through. */
export async function checkPayment(cfg: DpoConfig, token: string, f: Fetch = fetch): Promise<PaymentState> {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
<CompanyToken>${escapeXml(cfg.companyToken)}</CompanyToken>
<Request>verifyToken</Request>
<TransactionToken>${escapeXml(token)}</TransactionToken>
</API3G>`;
  const r = await call(cfg, xml, f);
  if (r.Result === "000") {
    const amountMinor = Math.round(Number(r.TransactionAmount ?? "NaN") * 100);
    return { state: "paid", reference: r.TransactionApproval || r.TransactionRef || token, amountMinor, currency: r.TransactionCurrency ?? "" };
  }
  if (WAITING.has(r.Result ?? "")) return { state: "waiting" };
  return { state: "failed", reason: r.ResultExplanation || "The payment didn't go through." };
}
