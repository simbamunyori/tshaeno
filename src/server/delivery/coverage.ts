import type { DeliveryState } from "@prisma/client";

/**
 * Who has their signature, who doesn't, and why. Pure, so the reasons are
 * easy to test; the coverage page feeds it what it read.
 */

export type CoverageStatus = "covered" | "waiting" | "problem" | "missing";

export interface CoverageInput {
  hasRule: boolean;
  inGoogle: boolean;
  googlePush: boolean;
  addinDeployed: boolean;
  gmail?: { state: DeliveryState; lastError: string | null } | null;
  outlook?: { state: DeliveryState; appliedAt: Date | null } | null;
}

export interface Coverage {
  status: CoverageStatus;
  gmail: string | null;
  outlook: string | null;
  reason: string;
}

/** The add-in counts as working for someone if it ran for them this recently. */
export const OUTLOOK_RECENT_DAYS = 30;

export function coverageOf(p: CoverageInput, now = new Date()): Coverage {
  const outlookRecent = !!p.outlook?.appliedAt && now.getTime() - p.outlook.appliedAt.getTime() < OUTLOOK_RECENT_DAYS * 86400_000;
  const gmailOn = p.inGoogle && p.googlePush;
  const gmail = !gmailOn ? null : p.gmail?.state === "APPLIED" ? "Set" : p.gmail?.state === "FAILED" ? "Failed" : p.gmail?.state === "SKIPPED" ? "Not set" : "Waiting";
  const outlook = !p.addinDeployed ? null : outlookRecent && p.outlook?.state === "APPLIED" ? "Working" : outlookRecent ? "No signature" : "Not seen yet";

  if (!p.hasRule) return { status: "missing", gmail, outlook, reason: "No signature rule covers them." };
  if (gmailOn && p.gmail?.state === "FAILED") return { status: "problem", gmail, outlook, reason: p.gmail.lastError ?? "Gmail wouldn't take the signature." };
  if ((gmailOn && p.gmail?.state === "APPLIED") || (outlookRecent && p.outlook?.state === "APPLIED")) {
    return { status: "covered", gmail, outlook, reason: "" };
  }
  if (gmailOn) return { status: "waiting", gmail, outlook, reason: p.gmail?.lastError ? `Trying again: ${p.gmail.lastError}` : "Waiting to be set in Gmail." };
  if (p.addinDeployed) return { status: "missing", gmail, outlook, reason: "The Outlook add-in hasn't run for them yet. Check it is deployed to them." };
  if (p.googlePush) return { status: "missing", gmail, outlook, reason: "Not in your Google directory, and there's no Outlook add-in." };
  return { status: "missing", gmail, outlook, reason: "Connect Google Workspace or deploy the Outlook add-in." };
}
