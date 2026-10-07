"use server";

import type { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requestContext } from "@/server/auth/next";
import { kickMail } from "@/server/jobs/queue";
import { DomainError, ROLES } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { changeRole, inviteMember, removeMember, resendInvitation, revokeInvitation } from "@/server/org/members";

export interface TeamState {
  ok?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

async function ctx() {
  const { organisation, actor } = await requireMember();
  return { organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress };
}

function role(v: FormDataEntryValue | null): Role {
  if (typeof v === "string" && (ROLES as string[]).includes(v)) return v as Role;
  throw new DomainError("invalid", "Choose a role.", "role");
}

async function run(fn: () => Promise<unknown>, ok: string): Promise<TeamState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof DomainError) return e.field ? { fieldErrors: { [e.field]: e.message } } : { error: e.message };
    throw e;
  }
  revalidatePath("/app/team");
  return { ok };
}

export async function inviteAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  const email = String(form.get("email") ?? "");
  const result = await run(async () => inviteMember(await ctx(), { email, role: role(form.get("role")) }), `Invitation sent to ${email.trim()}.`);
  if (result.ok) await kickMail();
  return result;
}

export async function resendAction(form: FormData) {
  await run(async () => resendInvitation(await ctx(), String(form.get("id"))), "Sent again.");
  await kickMail();
}

export async function revokeAction(form: FormData) {
  await run(async () => revokeInvitation(await ctx(), String(form.get("id"))), "Withdrawn.");
}

export async function changeRoleAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  return run(async () => changeRole(await ctx(), String(form.get("id")), role(form.get("role"))), "Role changed.");
}

export async function removeAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  return run(async () => removeMember(await ctx(), String(form.get("id"))), "Removed.");
}
