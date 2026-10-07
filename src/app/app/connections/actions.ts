"use server";

import { revalidatePath } from "next/cache";
import { requestContext } from "@/server/auth/next";
import { appOrigin } from "@/server/env";
import { connectGoogle, disconnect, microsoftConsentLink, recheck, updateConnection } from "@/server/connections/service";
import { kickDelivery, kickSync } from "@/server/jobs/queue";
import { DomainError, assertCan } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { asTenant } from "@/server/db";
import { replaceAddinKey } from "@/server/outlook/addin";

async function ctx() {
  const { organisation, actor } = await requireMember();
  return { organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress };
}

export interface ConnectState {
  ok?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  link?: string;
}

const s = (form: FormData, k: string) => String(form.get(k) ?? "");
const PATH = "/app/connections";

function failure(e: unknown): ConnectState {
  if (e instanceof DomainError) return e.field ? { fieldErrors: { [e.field]: e.message } } : { error: e.message };
  throw e;
}

export async function connectGoogleAction(_prev: ConnectState, form: FormData): Promise<ConnectState> {
  let c;
  try {
    c = await connectGoogle(await ctx(), s(form, "adminEmail"));
  } catch (e) {
    return failure(e);
  }
  if (c.status === "CONNECTED") await kickSync(c.id);
  revalidatePath(PATH);
  return c.status === "CONNECTED" ? { ok: "Connected. Your people are syncing now." } : { error: "Not everything is working yet. The checks below say what to fix." };
}

export async function consentLinkAction(): Promise<ConnectState> {
  try {
    const link = await microsoftConsentLink(await ctx(), `${appOrigin().origin}/connect/microsoft/callback`);
    revalidatePath(PATH);
    return { link };
  } catch (e) {
    return failure(e);
  }
}

export async function recheckAction(form: FormData) {
  const c = await recheck(await ctx(), s(form, "id"));
  if (c.status === "CONNECTED" && !c.lastSyncAt) await kickSync(c.id);
  revalidatePath(PATH);
}

export async function syncNowAction(form: FormData) {
  const { organisationId, actor } = await ctx();
  assertCan(actor, "manageOrganisation");
  const id = s(form, "id");
  const found = await asTenant(organisationId, (tx) => tx.directoryConnection.findFirst({ where: { id }, select: { id: true } }));
  if (found) await kickSync(found.id);
  revalidatePath(PATH);
}

export async function settingsAction(form: FormData) {
  const c = await ctx();
  const updated = await updateConnection(c, s(form, "id"), { syncEnabled: form.get("syncEnabled") === "on", pushEnabled: form.get("pushEnabled") === "on" });
  if (updated.pushEnabled) await kickDelivery(c.organisationId);
  revalidatePath(PATH);
}

export async function disconnectAction(form: FormData) {
  await disconnect(await ctx(), s(form, "id"));
  revalidatePath(PATH);
}

export async function replaceKeyAction() {
  await replaceAddinKey(await ctx());
  revalidatePath(PATH);
}
