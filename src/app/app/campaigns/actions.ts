"use server";

import type { Audience } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/ui/action-form";
import { fromLocalInput } from "@/lib/zoned-time";
import { requestContext } from "@/server/auth/next";
import { deleteCampaign, endCampaign, saveCampaign, setPaused, type CampaignInput } from "@/server/campaigns/service";
import { kickDelivery } from "@/server/jobs/queue";
import { DomainError } from "@/server/org/access";
import { requireMember } from "@/server/org/context";

async function ctx() {
  const { organisation, actor } = await requireMember();
  return { organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress, timeZone: organisation.timeZone };
}

function failure(e: unknown): FormState {
  if (e instanceof DomainError) return e.field ? { error: e.message, fieldErrors: { [e.field]: e.message } } : { error: e.message };
  throw e;
}

const SCOPES = ["EVERYONE", "LOCATION", "DEPARTMENT", "GROUP"] as const;
const AUDIENCES: Audience[] = ["ANY", "INTERNAL", "EXTERNAL"];

export async function saveCampaignAction(_prev: FormState, form: FormData): Promise<FormState> {
  const c = await ctx();
  const s = (k: string) => String(form.get(k) ?? "");
  const id = s("id") || null;
  const file = form.get("file");
  const image = file instanceof File && file.size > 0 ? Buffer.from(await file.arrayBuffer()) : null;
  const scope = SCOPES.find((x) => x === s("scope")) ?? "EVERYONE";
  const startsRaw = s("startsAt");
  const endsRaw = s("endsAt");
  const startsAt = startsRaw ? fromLocalInput(startsRaw, c.timeZone) : null;
  const endsAt = endsRaw ? fromLocalInput(endsRaw, c.timeZone) : null;
  if (startsRaw && !startsAt) return { error: "Enter when it starts.", fieldErrors: { startsAt: "Enter a date and time." } };
  if (endsRaw && !endsAt) return { error: "Enter when it ends.", fieldErrors: { endsAt: "Enter a date and time." } };
  const input: CampaignInput = {
    name: s("name"),
    linkUrl: s("linkUrl"),
    alt: s("alt"),
    width: Number(s("width") || 480),
    startsAt,
    endsAt,
    scope,
    target: s(`target_${scope}`),
    audience: AUDIENCES.find((a) => a === s("audience")) ?? "EXTERNAL",
    forNew: form.get("forNew") === "on",
    forReply: form.get("forReply") === "on",
  };
  let saved;
  try {
    saved = await saveCampaign(c, id, input, image);
  } catch (e) {
    return failure(e);
  }
  await kickDelivery(c.organisationId);
  revalidatePath("/app/campaigns");
  if (!id) redirect(`/app/campaigns/${saved.id}?created=1`);
  revalidatePath(`/app/campaigns/${id}`);
  return { ok: "Saved. Gmail signatures update in a minute or two; Outlook picks it up on the next email." };
}

export async function pauseCampaignAction(form: FormData) {
  const c = await ctx();
  const id = String(form.get("id"));
  await setPaused(c, id, form.get("paused") === "1");
  await kickDelivery(c.organisationId);
  revalidatePath(`/app/campaigns/${id}`);
  revalidatePath("/app/campaigns");
}

export async function endCampaignAction(form: FormData) {
  const c = await ctx();
  const id = String(form.get("id"));
  await endCampaign(c, id);
  await kickDelivery(c.organisationId);
  revalidatePath(`/app/campaigns/${id}`);
  revalidatePath("/app/campaigns");
}

export async function deleteCampaignAction(form: FormData) {
  const c = await ctx();
  await deleteCampaign(c, String(form.get("id")));
  await kickDelivery(c.organisationId);
  revalidatePath("/app/campaigns");
  redirect("/app/campaigns");
}
