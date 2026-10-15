/**
 * Demo requests from the website, against a real database.
 */
import { describe, expect, it } from "vitest";
import { recentDemoRequests, requestDemo } from "../src/server/demo";
import { db, dbUrl, tag } from "./helpers";

const staff = { userId: "staff", name: "Staff", isPlatformAdmin: true };

describe.skipIf(!dbUrl)("demo requests", () => {
  const form = (email: string) => ({ name: "Lerato Nkwe", email, company: "Meridian Advisory", people: "25", phone: "", message: "Three offices." });

  it("records a request and shows it to staff", async () => {
    const email = `demo-${tag()}@example.com`;
    const row = await requestDemo(form(email), null, db);
    expect(row.people).toBe(25);
    expect(row.phone).toBeNull();
    const recent = await recentDemoRequests(staff, db);
    expect(recent.some((r) => r.id === row.id)).toBe(true);
    await expect(recentDemoRequests({ ...staff, isPlatformAdmin: false }, db)).rejects.toThrow();
  });

  it("checks what was sent", async () => {
    await expect(requestDemo({ ...form("not-an-email"), email: "nope" }, null, db)).rejects.toMatchObject({ field: "email" });
    await expect(requestDemo({ ...form(`demo-${tag()}@example.com`), people: "0" }, null, db)).rejects.toMatchObject({ field: "people" });
  });

  it("takes one request per address a day, and a few per network an hour", async () => {
    const email = `demo-${tag()}@example.com`;
    await requestDemo(form(email), null, db);
    await expect(requestDemo(form(email.toUpperCase()), null, db)).rejects.toThrow(/already have your request/);

    const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.9`;
    for (let i = 0; i < 3; i++) await requestDemo(form(`demo-${tag()}@example.com`), ip, db);
    await expect(requestDemo(form(`demo-${tag()}@example.com`), ip, db)).rejects.toThrow(/try again a little later/);
  });
});
