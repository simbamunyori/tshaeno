"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/ui/action-form";
import { requestContext } from "@/server/auth/next";
import { deleteBackground, saveBackground } from "@/server/backgrounds/service";
import { DomainError } from "@/server/org/access";
import { requireMember } from "@/server/org/context";

async function ctx() {
  const { organisation, actor } = await requireMember();
  return { organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress };
}

function failure(e: unknown): FormState {
  if (e instanceof DomainError) return e.field ? { error: e.message, fieldErrors: { [e.field]: e.message } } : { error: e.message };
  throw e;
}

export async function saveBackgroundAction(_prev: FormState, form: FormData): Promise<FormState> {
  const s = (k: string) => String(form.get(k) ?? "");
  const id = s("id") || null;
  const file = form.get("file");
  const image = file instanceof File && file.size > 0 ? Buffer.from(await file.arrayBuffer()) : null;
  let saved;
  try {
    saved = await saveBackground(
      await ctx(),
      id,
      { name: s("name"), style: s("style"), colour: s("colour"), brandKitId: s("brandKitId") || null, showName: s("showName") === "on", showTitle: s("showTitle") === "on", published: s("published") === "on" },
      image,
    );
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/app/backgrounds");
  if (!id) redirect(`/app/backgrounds/${saved.id}?created=1`);
  return { ok: "Saved." };
}

export async function deleteBackgroundAction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    await deleteBackground(await ctx(), String(form.get("id") ?? ""));
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/app/backgrounds");
  redirect("/app/backgrounds");
}
