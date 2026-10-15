"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/ui/action-form";
import { kickDelivery } from "@/server/jobs/queue";
import { DomainError } from "@/server/org/access";
import { clearPortalCookie, readPortalToken, requirePortal, setPortalCookie } from "@/server/portal/next";
import { SENT_MESSAGE, endSession, requestLink, saveOwnSocials, setOwnPhoto, redeemLink } from "@/server/portal/service";

function failure(e: unknown): FormState {
  if (e instanceof DomainError) return e.field ? { fieldErrors: { [e.field]: e.message } } : { error: e.message };
  throw e;
}

export async function requestLinkAction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    await requestLink(String(form.get("email") ?? ""));
  } catch (e) {
    return failure(e);
  }
  return { ok: SENT_MESSAGE };
}

export async function redeemLinkAction(_prev: FormState, form: FormData): Promise<FormState> {
  const r = await redeemLink(String(form.get("token") ?? ""));
  if ("error" in r) return { error: r.error };
  await setPortalCookie(r.session);
  redirect("/me/profile");
}

export async function socialsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const s = await requirePortal();
  const input: Record<string, string> = {};
  for (const n of s.networks) input[n] = String(form.get(`social_${n}`) ?? "");
  try {
    await saveOwnSocials(s, input);
  } catch (e) {
    return failure(e);
  }
  await kickDelivery(s.organisation.id);
  revalidatePath("/me/profile");
  return { ok: "Saved. Your signature updates in a few minutes." };
}

export async function photoAction(_prev: FormState, form: FormData): Promise<FormState> {
  const s = await requirePortal();
  try {
    if (form.get("remove") === "1") await setOwnPhoto(s, null);
    else {
      const file = form.get("file");
      if (!(file instanceof File) || !file.size) return { fieldErrors: { file: "Choose a photo." } };
      await setOwnPhoto(s, Buffer.from(await file.arrayBuffer()));
    }
  } catch (e) {
    return failure(e);
  }
  await kickDelivery(s.organisation.id);
  revalidatePath("/me/profile");
  return { ok: form.get("remove") === "1" ? "Photo removed." : "Photo saved. Your signature updates in a few minutes." };
}

export async function signOutAction() {
  await endSession(await readPortalToken());
  await clearPortalCookie();
  redirect("/me?signed-out=1");
}
