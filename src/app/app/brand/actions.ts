"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestContext } from "@/server/auth/next";
import { DomainError } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { kickDelivery } from "@/server/jobs/queue";
import { createKit, deleteKit, makeDefaultKit, setKitLogo, updateKit } from "@/server/signatures/brand";

/** Signatures may have changed: bring Gmail up to date. */
const kick = async () => kickDelivery((await requireMember()).organisation.id);

async function ctx() {
  const { organisation, actor } = await requireMember();
  return { organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress };
}

export interface BrandState {
  ok?: string;
  error?: string;
  field?: string;
}

function failure(e: unknown): BrandState {
  if (e instanceof DomainError) return { error: e.message, field: e.field };
  throw e;
}

export async function createKitAction(form: FormData) {
  const kit = await createKit(await ctx(), String(form.get("name") ?? "") || "New brand kit");
  redirect(`/app/brand/${kit.id}`);
}

export async function saveKitAction(id: string, input: { name: string; data: unknown }): Promise<BrandState> {
  try {
    await updateKit(await ctx(), id, input);
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/app/brand");
  await kick();
  revalidatePath(`/app/brand/${id}`);
  return { ok: "Saved. Every signature using this kit has the change." };
}

export async function logoAction(form: FormData): Promise<BrandState & { logo?: { url: string; width: number; height: number } | null }> {
  const id = String(form.get("id"));
  const file = form.get("file");
  try {
    if (form.get("remove") === "1") {
      await setKitLogo(await ctx(), id, null);
      revalidatePath(`/app/brand/${id}`);
      await kick();
      return { ok: "Logo removed.", logo: null };
    }
    if (!(file instanceof File) || !file.size) return { error: "Choose an image.", field: "file" };
    await setKitLogo(await ctx(), id, Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return failure(e);
  }
  revalidatePath(`/app/brand/${id}`);
  await kick();
  return { ok: "Logo saved." };
}

export async function makeDefaultAction(form: FormData) {
  await makeDefaultKit(await ctx(), String(form.get("id")));
  revalidatePath("/app/brand");
  await kick();
}

export async function deleteKitAction(form: FormData) {
  await deleteKit(await ctx(), String(form.get("id")));
  revalidatePath("/app/brand");
  await kick();
  redirect("/app/brand");
}
