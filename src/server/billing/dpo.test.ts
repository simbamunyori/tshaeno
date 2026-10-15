import { describe, expect, it } from "vitest";
import { checkPayment, createPayment, readXml } from "./dpo";

const CFG = { companyToken: "CT&1", serviceType: "5525", apiUrl: "https://dpo.test/API/v6/", payUrl: "https://dpo.test/payv2.php" };

const reply = (xml: string): typeof fetch => async () => new Response(xml);

describe("DPO Pay", () => {
  it("reads DPO's flat XML", () => {
    expect(readXml("<API3G><Result>000</Result><ResultExplanation>Paid &amp; done</ResultExplanation></API3G>")).toEqual({ Result: "000", ResultExplanation: "Paid & done" });
  });

  it("creates a payment with the amount in units and escaped values", async () => {
    let sent = "";
    const f: typeof fetch = async (_u, init) => {
      sent = String(init?.body);
      return new Response("<API3G><Result>000</Result><TransToken>ABC-123</TransToken></API3G>");
    };
    const r = await createPayment(CFG, { reference: "TSH-2026-00001", amountMinor: 123456, currency: "BWP", description: "Invoice <1>", redirectUrl: "https://a/b?x=1&y=2", backUrl: "https://a/c" }, f);
    expect(r).toEqual({ token: "ABC-123", url: "https://dpo.test/payv2.php?ID=ABC-123" });
    expect(sent).toContain("<PaymentAmount>1234.56</PaymentAmount>");
    expect(sent).toContain("<CompanyToken>CT&amp;1</CompanyToken>");
    expect(sent).toContain("<RedirectURL>https://a/b?x=1&amp;y=2</RedirectURL>");
    expect(sent).toContain("<ServiceDescription>Invoice &lt;1&gt;</ServiceDescription>");
  });

  it("explains a refused payment", async () => {
    await expect(createPayment(CFG, { reference: "x", amountMinor: 1, currency: "BWP", description: "x", redirectUrl: "x", backUrl: "x" }, reply("<API3G><Result>801</Result></API3G>"))).rejects.toThrow(/bank transfer/);
    await expect(createPayment(CFG, { reference: "x", amountMinor: 1, currency: "BWP", description: "x", redirectUrl: "x", backUrl: "x" }, async () => new Response("down", { status: 503 }))).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("tells paid, waiting and failed apart", async () => {
    expect(await checkPayment(CFG, "T", reply("<API3G><Result>000</Result><TransactionApproval>A1</TransactionApproval><TransactionAmount>12.50</TransactionAmount><TransactionCurrency>ZAR</TransactionCurrency></API3G>"))).toEqual({
      state: "paid",
      reference: "A1",
      amountMinor: 1250,
      currency: "ZAR",
    });
    expect(await checkPayment(CFG, "T", reply("<API3G><Result>900</Result></API3G>"))).toEqual({ state: "waiting" });
    expect(await checkPayment(CFG, "T", reply("<API3G><Result>904</Result><ResultExplanation>Cancelled</ResultExplanation></API3G>"))).toEqual({ state: "failed", reason: "Cancelled" });
  });
});
