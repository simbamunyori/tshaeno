"use server";

import type { AssignmentScope, Audience, TemplateKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestContext } from "@/server/auth/next";
import { DomainError } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { kickDelivery } from "@/server/jobs/queue";
import { uploadSignatureImage, type AssetOption } from "@/server/signatures/studio-data";
import {
  addAssignment,
  createTemplate,
  duplicateTemplate,
  publishTemplate,
  removeAssignment,
  saveDraft,
  setArchived,
} from "@/server/signatures/templates";

/** Signatures may have changed: bring Gmail up to date. */
const kick = async () => kickDelivery((await requireMember()).organisation.id);

async function ctx() {
  const { organisation, actor } = await requireMember();
  return { organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress };
}

export interface ActionResult {
  ok?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function failure(e: unknown): ActionResult {
  if (e instanceof DomainError) return e.field ? { error: e.message, fieldErrors: { [e.field]: e.message } } : { error: e.message };
  throw e;
}

export async function createTemplateAction(form: FormData) {
  const kind: TemplateKind = form.get("kind") === "HTML" ? "HTML" : "VISUAL";
  const starterKey = String(form.get("starter") ?? "") || null;
  const name = String(form.get("name") ?? "") || (kind === "HTML" ? "HTML signature" : "New signature");
  const t = await createTemplate(await ctx(), { name, kind, starterKey });
  redirect(`/app/signatures/${t.id}`);
}

export async function saveDraftAction(id: string, payload: { content: unknown; name: string; brandKitId: string | null }): Promise<ActionResult & { savedAt?: string }> {
  try {
    const r = await saveDraft(await ctx(), id, payload);
    return { savedAt: r.updatedAt.toISOString() };
  } catch (e) {
    return failure(e);
  }
}

export async function publishAction(id: string, payload: { content: unknown; name: string; brandKitId: string | null }): Promise<ActionResult & { version?: number }> {
  try {
    const c = await ctx();
    await saveDraft(c, id, payload);
    const v = await publishTemplate(c, id);
    revalidatePath("/app/signatures");
    await kick();
    return { ok: `Published version ${v.number}.`, version: v.number };
  } catch (e) {
    return failure(e);
  }
}

export async function uploadImageAction(form: FormData): Promise<ActionResult & { asset?: AssetOption }> {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose an image." };
  try {
    const kind = form.get("kind") === "BANNER" ? "BANNER" : "IMAGE";
    const asset = await uploadSignatureImage(await ctx(), Buffer.from(await file.arrayBuffer()), kind);
    return { asset };
  } catch (e) {
    return failure(e);
  }
}

export async function duplicateAction(form: FormData) {
  const t = await duplicateTemplate(await ctx(), String(form.get("id")));
  redirect(`/app/signatures/${t.id}`);
}

export async function archiveAction(form: FormData) {
  const id = String(form.get("id"));
  await setArchived(await ctx(), id, form.get("archived") === "1");
  revalidatePath("/app/signatures");
  await kick();
  revalidatePath(`/app/signatures/${id}`);
}

export async function addAssignmentAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const id = String(form.get("templateId"));
  const scope = String(form.get("scope")) as AssignmentScope;
  const usage = String(form.get("usage") ?? "both");
  try {
    if (!["EVERYONE", "DEPARTMENT", "GROUP", "LOCATION", "PERSON"].includes(scope)) throw new DomainError("invalid", "Choose who gets it.", "scope");
    const audience = String(form.get("audience") ?? "ANY") as Audience;
    if (!["ANY", "INTERNAL", "EXTERNAL"].includes(audience)) throw new DomainError("invalid", "Choose who the emails go to.", "audience");
    await addAssignment(await ctx(), {
      templateId: id,
      scope,
      department: String(form.get("department") ?? ""),
      groupName: String(form.get("groupName") ?? ""),
      location: String(form.get("location") ?? ""),
      personId: String(form.get("personId") ?? ""),
      forNew: usage !== "reply",
      forReply: usage !== "new",
      audience,
    });
  } catch (e) {
    return failure(e);
  }
  revalidatePath(`/app/signatures/${id}/people`);
  await kick();
  return { ok: "Rule added." };
}

export async function removeAssignmentAction(form: FormData) {
  await removeAssignment(await ctx(), String(form.get("id")));
  revalidatePath(`/app/signatures/${String(form.get("templateId"))}/people`);
  await kick();
}
