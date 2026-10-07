/**
 * Plans, invoices, payments and the daily billing round, against a real
 * database, with a stand-in for DPO Pay.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asSystem, asTenant } from "../src/server/db";
import type { Actor } from "../src/server/org/access";
import { DAY } from "../src/lib/billing/plans";
import { addSeats, billingTick, changeRenewal, checkout, confirmDpoPayment, markPaid, payOnline, requestQuote, subscriptionOf, type BillingDeps } from "../src/server/billing/service";
import { OrgRenderer } from "../src/server/delivery/renderer";
import { GMAIL_CONTEXT } from "../src/server/delivery/gmail";
import { quickStart, startState } from "../src/server/onboarding/service";
import { onboardingStats, recordBankPayment, setPrice } from "../src/server/platform/service";
import { savePerson } from "../src/server/signatures/people";
import { db, dbUrl, newOwner, testDeps } from "./helpers";

const ORIGIN = "https://app.tshaeno.test";

/** DPO Pay's API, in memory. */
class FakeDpo {
  payments = new Map<string, { amount: string; currency: string; ref: string; result: string }>();
  n = 0;
  fetch: typeof fetch = async (_url, init) => {
    const body = String(init?.body);
    const tag = (t: string) => new RegExp(`<${t}>([^<]*)</${t}>`).exec(body)?.[1] ?? "";
    if (tag("Request") === "createToken") {
      const token = `TOKEN-${++this.n}-${randomUUID()}`;
      this.payments.set(token, { amount: tag("PaymentAmount"), currency: tag("PaymentCurrency"), ref: tag("CompanyRef"), result: "900" });
      return new Response(`<?xml version="1.0" encoding="utf-8"?><API3G><Result>000</Result><ResultExplanation>Transaction created</ResultExplanation><TransToken>${token}</TransToken><TransRef>R${this.n}</TransRef></API3G>`);
    }
    const p = this.payments.get(tag("TransactionToken"));
    if (!p) return new Response("<API3G><Result>950</Result><ResultExplanation>Unknown</ResultExplanation></API3G>");
    return new Response(
      `<API3G><Result>${p.result}</Result><ResultExplanation>${p.result === "000" ? "Transaction paid" : "Not paid yet"}</ResultExplanation><TransactionApproval>APP${this.n}</TransactionApproval><TransactionCurrency>${p.currency}</TransactionCurrency><TransactionAmount>${p.amount}</TransactionAmount></API3G>`,
    );
  };
}

describe.skipIf(!dbUrl)("plans and billing", () => {
  const deps = testDeps();
  const dpo = new FakeDpo();
  let owner: Awaited<ReturnType<typeof newOwner>>;
  let actor: Actor;
  const ctx = () => ({ db, organisationId: owner.organisationId, actor });
  const orgId = () => owner.organisationId;
  const billing = (now = new Date(), online = true): BillingDeps => ({
    dpo: online ? { companyToken: "CT", serviceType: "1", apiUrl: "https://dpo.test/API/v6/", payUrl: "https://dpo.test/payv2.php" } : null,
    fetch: dpo.fetch,
    origin: ORIGIN,
    now,
    only: [owner.organisationId],
  });
  const sub = () => asTenant(orgId(), (tx) => subscriptionOf(tx, orgId()), db);
  const outbox = (kind: string) => asSystem((tx) => tx.outboundEmail.count({ where: { kind, toAddress: owner.email } }), db);
  const details = { billingName: "", billingEmail: "", billingAddress: "Plot 50369, Gaborone", taxNumber: "" };

  beforeAll(async () => {
    owner = await newOwner(deps);
    const m = await asTenant(owner.organisationId, (tx) => tx.membership.findFirstOrThrow({ where: { userId: owner.userId } }));
    actor = { membershipId: m.id, userId: owner.userId, name: "Neo Dube", role: "OWNER" };
    for (const [i, name] of ["Lesedi", "Kabo", "Thato"].entries()) await savePerson(ctx(), null, { email: `p${i}@kalahari.example`, firstName: name });
  });
  afterAll(() => db.$disconnect());

  it("starts every new organisation on a trial, priced in its own currency", async () => {
    const s = await sub();
    expect(s).toMatchObject({ status: "TRIALING", currency: "BWP", billedBy: "DIRECT" });
    const days = (s.trialEndsAt!.getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);
  });

  it("only lets owners pay, and never for fewer people than the directory has", async () => {
    const input = { seats: 3, interval: "MONTHLY" as const, currency: "BWP" as const, method: "BANK_TRANSFER" as const, ...details };
    await expect(checkout({ ...ctx(), actor: { ...actor, role: "ADMIN" } }, input, billing())).rejects.toMatchObject({ code: "forbidden" });
    await expect(checkout(ctx(), { ...input, seats: 2 }, billing())).rejects.toMatchObject({ field: "seats" });
    await expect(checkout(ctx(), { ...input, seats: 1200 }, billing())).rejects.toThrow(/quote/);
    await expect(checkout(ctx(), { ...input, method: "DPO" }, billing(new Date(), false))).rejects.toMatchObject({ field: "method" });
    await expect(checkout(ctx(), { ...input, billingEmail: "not an email" }, billing())).rejects.toMatchObject({ field: "billingEmail" });
  });

  let firstInvoice = "";

  it("issues a numbered invoice for bank transfer, replacing an earlier unpaid one", async () => {
    const input = { seats: 5, interval: "ANNUAL" as const, currency: "BWP" as const, method: "BANK_TRANSFER" as const, ...details };
    const first = await checkout(ctx(), input, billing());
    expect(first.payUrl).toBeNull();
    const second = await checkout(ctx(), { ...input, seats: 6 }, billing());
    const invoices = await asTenant(orgId(), (tx) => tx.invoice.findMany({ orderBy: { issuedAt: "asc" } }));
    expect(invoices.map((i) => i.status)).toEqual(["VOID", "OPEN"]);
    const inv = invoices[1];
    firstInvoice = inv.id;
    expect(inv.id).toBe(second.invoiceId);
    expect(inv.number).toMatch(/^TSH-\d{4}-\d{5}$/);
    expect(Number(inv.number.slice(-5))).toBe(Number(invoices[0].number.slice(-5)) + 1);
    // Starter yearly in BWP: P16.67 a person a month, six people, twelve months.
    expect(inv).toMatchObject({ kind: "NEW", tier: "STARTER", seats: 6, currency: "BWP", subtotalMinor: 1667 * 6 * 12, totalMinor: 1667 * 6 * 12 });
    expect(inv.billTo).toMatchObject({ name: expect.stringMatching(/^Kalahari Freight/), address: "Plot 50369, Gaborone" });
    expect(await outbox("invoice")).toBe(2);
    expect((await sub()).status).toBe("TRIALING");
  });

  it("starts the plan when staff record the bank payment, once", async () => {
    const staff = { userId: owner.userId, name: "Staff", isPlatformAdmin: true };
    await expect(recordBankPayment({ ...staff, isPlatformAdmin: false }, firstInvoice, "X", null, db)).rejects.toMatchObject({ code: "forbidden" });
    await expect(recordBankPayment(staff, firstInvoice, " ", null, db)).rejects.toMatchObject({ field: "reference" });
    await recordBankPayment(staff, firstInvoice, "FNB 123", null, db);
    const s = await sub();
    expect(s).toMatchObject({ status: "ACTIVE", tier: "STARTER", interval: "ANNUAL", seats: 6 });
    const yearLater = new Date(s.periodStart!);
    yearLater.setUTCFullYear(yearLater.getUTCFullYear() + 1);
    expect(s.periodEnd!.getTime()).toBe(yearLater.getTime());
    const again = await markPaid(firstInvoice, { reference: "again", by: { userId: null, name: "x" } }, db);
    expect(again.paymentRef).toBe("Bank FNB 123");
    expect(await outbox("payment_received")).toBe(1);
    await expect(recordBankPayment(staff, firstInvoice, "FNB 124", null, db)).rejects.toMatchObject({ code: "conflict" });
  });

  it("charges added people for the rest of the period, through DPO Pay", async () => {
    await expect(addSeats(ctx(), 6, "DPO", billing())).rejects.toMatchObject({ field: "seats" });
    const s = await sub();
    const halfway = new Date((s.periodStart!.getTime() + s.periodEnd!.getTime()) / 2);
    const { invoiceId, payUrl } = await addSeats(ctx(), 10, "DPO", billing(halfway));
    expect(payUrl).toMatch(/^https:\/\/dpo\.test\/payv2\.php\?ID=TOKEN-[\w-]+$/);
    const inv = await asTenant(orgId(), (tx) => tx.invoice.findFirstOrThrow({ where: { id: invoiceId } }));
    // Four more people, half a year at P16.67 a month.
    expect(inv).toMatchObject({ kind: "SEATS", seats: 10, totalMinor: Math.round((4 * 1667 * 12) / 2) });
    const token = inv.dpoToken!;
    expect(dpo.payments.get(token)).toMatchObject({ amount: (inv.totalMinor / 100).toFixed(2), currency: "BWP", ref: inv.number });

    expect(await confirmDpoPayment(token, billing(halfway), db)).toMatchObject({ ok: false, message: expect.stringMatching(/hasn't gone through/) });
    // A payment for the wrong amount is never accepted.
    dpo.payments.get(token)!.result = "000";
    dpo.payments.get(token)!.amount = "1.00";
    expect(await confirmDpoPayment(token, billing(halfway), db)).toMatchObject({ ok: false, message: expect.stringMatching(/doesn't match/) });
    dpo.payments.get(token)!.amount = (inv.totalMinor / 100).toFixed(2);
    expect(await confirmDpoPayment(token, billing(halfway), db)).toMatchObject({ ok: true });
    expect(await sub()).toMatchObject({ seats: 10, status: "ACTIVE" });
    await expect(payOnline(ctx(), invoiceId, billing())).rejects.toThrow(/already paid/);
  });

  it("renews: invoice a week ahead, overdue at the end, free after the grace period", async () => {
    await changeRenewal(ctx(), { interval: "MONTHLY", currency: "BWP", seats: 4, showBadge: false, ...details });
    // The directory has three people; four were asked for.
    const s = await sub();
    const end = s.periodEnd!;
    const early = await billingTick(billing(new Date(end.getTime() - 10 * DAY)), db);
    expect(early.renewalsIssued).toBe(0);
    const week = await billingTick(billing(new Date(end.getTime() - 6 * DAY)), db);
    expect(week.renewalsIssued).toBe(1);
    expect((await billingTick(billing(new Date(end.getTime() - 5 * DAY)), db)).renewalsIssued).toBe(0);
    const renewal = await asTenant(orgId(), (tx) => tx.invoice.findFirstOrThrow({ where: { kind: "RENEWAL" } }));
    expect(renewal).toMatchObject({ seats: 4, interval: "MONTHLY", totalMinor: 2000 * 4, status: "OPEN" });
    expect(renewal.periodStart.getTime()).toBe(end.getTime());

    expect((await billingTick(billing(new Date(end.getTime() + 1000)), db)).pastDue).toBe(1);
    expect((await sub()).status).toBe("PAST_DUE");
    expect((await billingTick(billing(new Date(end.getTime() + 15 * DAY)), db)).droppedToFree).toBe(1);
    expect(await sub()).toMatchObject({ status: "FREE", seats: 0 });
    expect((await asTenant(orgId(), (tx) => tx.invoice.findFirstOrThrow({ where: { id: renewal.id } }))).status).toBe("VOID");
  });

  it("adds the Signature by Tshaeno link on the free plan only", async () => {
    await quickStart(ctx(), "general-everyday");
    const render = () =>
      asTenant(orgId(), async (tx) => {
        const p = await tx.person.findFirstOrThrow({ where: { email: "p0@kalahari.example" }, include: { photo: { select: { id: true, contentType: true, width: true, height: true } } } });
        return new OrgRenderer(tx, orgId(), ORIGIN).render(p, GMAIL_CONTEXT);
      });
    const free = await render();
    expect(free!.html).toContain("Signature by <a href=\"https://tshaeno.com/?ref=signature\"");
    expect(free!.text).toMatch(/Signature by Tshaeno: https:\/\/tshaeno.com/);
    await asSystem((tx) => tx.subscription.update({ where: { organisationId: orgId() }, data: { status: "TRIALING", trialEndsAt: new Date(Date.now() + DAY) } }), db);
    expect((await render())!.html).not.toContain("Signature by");
  });

  it("reminds before a trial ends, once, then drops to free", async () => {
    const before = await outbox("trial_ending");
    const now = new Date();
    expect((await billingTick(billing(now), db)).trialReminders).toBe(1);
    expect((await billingTick(billing(now), db)).trialReminders).toBe(0);
    expect(await outbox("trial_ending")).toBe(before + 1);
    expect((await billingTick(billing(new Date(now.getTime() + 2 * DAY)), db)).trialsEnded).toBe(1);
    expect((await sub()).status).toBe("FREE");
  });

  it("takes Enterprise quote requests, once a day", async () => {
    await requestQuote(ctx(), { people: 2500, note: "Group-wide" });
    await expect(requestQuote(ctx(), { people: 2500, note: "" })).rejects.toMatchObject({ code: "conflict" });
    const log = await asTenant(orgId(), (tx) => tx.auditLog.findFirstOrThrow({ where: { action: "billing.quote_requested" } }));
    expect(log.data).toMatchObject({ people: 2500, note: "Group-wide" });
  });

  it("lets staff change prices, within sense", async () => {
    const staff = { userId: owner.userId, name: "Staff", isPlatformAdmin: true };
    await expect(setPrice(staff, { tier: "ENTERPRISE", currency: "USD", monthlyMinor: 100, annualMinor: 90 }, null, db)).rejects.toThrow(/quote/);
    await expect(setPrice(staff, { tier: "STARTER", currency: "USD", monthlyMinor: 100, annualMinor: 120 }, null, db)).rejects.toMatchObject({ field: "annual" });
    await expect(setPrice(staff, { tier: "STARTER", currency: "USD", monthlyMinor: 0, annualMinor: 0 }, null, db)).rejects.toMatchObject({ field: "monthly" });
    const p = await asSystem((tx) => tx.planPrice.findUniqueOrThrow({ where: { tier_currency: { tier: "STARTER", currency: "USD" } } }), db);
    await setPrice(staff, { tier: "STARTER", currency: "USD", monthlyMinor: p.monthlyMinor, annualMinor: p.annualMinor }, null, db);
    const log = await asSystem((tx) => tx.platformAuditLog.findFirstOrThrow({ where: { action: "platform.price_changed", actorUserId: owner.userId } }), db);
    expect(log.data).toMatchObject({ tier: "STARTER", currency: "USD" });
  });

  it("tracks the guided start, and staff see how long it takes", async () => {
    const s = await startState(orgId(), new Date(), db);
    expect(s).toMatchObject({ people: 3, published: 1, rules: 1, connected: null, firstSignatureAt: null });
    await asTenant(orgId(), (tx) => tx.organisation.update({ where: { id: orgId() }, data: { firstSignatureAt: new Date() } }), db);
    const stats = await onboardingStats({ userId: owner.userId, name: "Staff", isPlatformAdmin: true }, db);
    expect(stats.signedUp).toBeGreaterThanOrEqual(1);
    expect(stats.live).toBeGreaterThanOrEqual(1);
    expect(stats.medianMinutes).not.toBeNull();
    // A second pick keeps the existing rule.
    expect((await quickStart(ctx(), "general-personal")).everyone).toBe(false);
  });
});
