"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authDeps, requestContext, requireActiveSession } from "@/server/auth/next";
import { removePasskey } from "@/server/auth/passkeys";
import { AuthError, unlinkIdentity } from "@/server/auth/service";
import { DomainError } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { renameOrganisation } from "@/server/org/members";

export interface SettingsState {
  ok?: string;
  error?: string;
}

export async function renameAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const { organisation, actor } = await requireMember();
  try {
    await renameOrganisation({ organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress }, String(form.get("name") ?? ""));
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  revalidatePath("/app", "layout");
  return { ok: "Saved." };
}

export async function removePasskeyAction(form: FormData) {
  const session = await requireActiveSession();
  try {
    await removePasskey(authDeps(), session, String(form.get("id")), await requestContext());
  } catch (e) {
    if (e instanceof AuthError) redirect(`/app/settings/security?message=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/app/settings/security");
}

export async function unlinkAction(form: FormData) {
  const session = await requireActiveSession();
  try {
    await unlinkIdentity(authDeps(), session, String(form.get("id")), await requestContext());
  } catch (e) {
    if (e instanceof AuthError) redirect(`/app/settings/security?message=${encodeURIComponent(e.message)}`);
    throw e;
  }
  revalidatePath("/app/settings/security");
}
