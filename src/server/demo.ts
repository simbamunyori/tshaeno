import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { asSystem } from "@/server/db";
import { env } from "@/server/env";
import { DomainError } from "@/server/org/access";
import { assertStaff, type StaffMember } from "@/server/platform/service";

/**
 * Demo requests from the website. Anyone can send one, so each is
 * checked, limited per address and per network, and only ever sent on
 * to Tshaeno's own sales inbox, never back to the address given.
 */

const HOUR = 60 * 60 * 1000;

export const demoSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: z.string().trim().toLowerCase().email("Enter your work email.").max(200),
  company: z.string().trim().min(2, "Enter your company.").max(120),
  people: z.coerce.number().int("Choose how many people.").min(1, "Choose how many people.").max(1_000_000),
  phone: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().max(1500).optional().default(""),
});

export type DemoInput = z.input<typeof demoSchema>;

export async function requestDemo(input: DemoInput, ipAddress: string | null, db?: PrismaClient, now = new Date()) {
  const parsed = demoSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new DomainError("invalid", first?.message ?? "Check the form.", first?.path.join("."));
  }
  const d = parsed.data;
  return asSystem(async (tx) => {
    const sameEmail = await tx.demoRequest.count({ where: { email: d.email, createdAt: { gt: new Date(now.getTime() - 24 * HOUR) } } });
    if (sameEmail) throw new DomainError("conflict", "We already have your request. Someone from our team will be in touch soon.");
    if (ipAddress) {
      const sameIp = await tx.demoRequest.count({ where: { ipAddress, createdAt: { gt: new Date(now.getTime() - HOUR) } } });
      if (sameIp >= 3) throw new DomainError("conflict", "We've had a few requests from your network in the last hour. Please try again a little later.");
    }
    const row = await tx.demoRequest.create({
      data: { name: d.name, email: d.email, company: d.company, people: d.people, phone: d.phone || null, message: d.message || null, ipAddress },
    });
    const sales = env().SALES_EMAIL;
    if (sales) {
      await tx.outboundEmail.create({
        data: {
          kind: "demo_request",
          toAddress: sales,
          payload: { name: d.name, email: d.email, company: d.company, people: String(d.people), phone: d.phone, message: d.message },
        },
      });
    }
    return row;
  }, db);
}

export async function recentDemoRequests(staff: StaffMember, db?: PrismaClient) {
  assertStaff(staff);
  return asSystem((tx) => tx.demoRequest.findMany({ orderBy: { createdAt: "desc" }, take: 20 }), db);
}
