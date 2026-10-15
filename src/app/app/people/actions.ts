"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestContext } from "@/server/auth/next";
import { DomainError } from "@/server/org/access";
import { requireMember } from "@/server/org/context";
import { kickDelivery } from "@/server/jobs/queue";
import { addCustomField, importPeople, removeCustomField, removePerson, savePerson, setPersonPhoto, setPersonSocials, type ImportResult } from "@/server/signatures/people";

/** Signatures may have changed: bring Gmail up to date. */
const kick = async () => kickDelivery((await requireMember()).organisation.id);

async function ctx() {
  const { organisation, actor } = await requireMember();
  return { organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress };
}

export interface PeopleState {
  ok?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  imported?: ImportResult;
}

function failure(e: unknown, values?: Record<string, string>): PeopleState {
  if (e instanceof DomainError) return e.field ? { fieldErrors: { [e.field]: e.message }, values } : { error: e.message, values };
  throw e;
}

const s = (form: FormData, k: string) => String(form.get(k) ?? "");

function personInput(form: FormData) {
  const custom: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("custom.") && typeof v === "string") custom[k.slice(7)] = v;
  return {
    email: s(form, "email"),
    firstName: s(form, "firstName"),
    lastName: s(form, "lastName"),
    title: s(form, "title"),
    department: s(form, "department"),
    location: s(form, "location"),
    phone: s(form, "phone"),
    mobile: s(form, "mobile"),
    custom,
  };
}

export async function savePersonAction(_prev: PeopleState, form: FormData): Promise<PeopleState> {
  const id = s(form, "id") || null;
  const input = personInput(form);
  const values = Object.fromEntries(Object.entries({ ...input, ...Object.fromEntries(Object.entries(input.custom).map(([k, v]) => [`custom.${k}`, v])) }).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  let personId: string;
  try {
    personId = (await savePerson(await ctx(), id, input)).id;
  } catch (e) {
    return failure(e, values);
  }
  revalidatePath("/app/people");
  await kick();
  if (!id) redirect(`/app/people/${personId}?added=1`);
  return { ok: "Saved." };
}

export async function removePersonAction(form: FormData) {
  await removePerson(await ctx(), s(form, "id"));
  revalidatePath("/app/people");
  redirect("/app/people");
}

export async function photoAction(_prev: PeopleState, form: FormData): Promise<PeopleState> {
  const id = s(form, "id");
  const file = form.get("file");
  try {
    if (form.get("remove") === "1") await setPersonPhoto(await ctx(), id, null);
    else {
      if (!(file instanceof File) || !file.size) return { fieldErrors: { file: "Choose a photo." } };
      await setPersonPhoto(await ctx(), id, Buffer.from(await file.arrayBuffer()));
    }
  } catch (e) {
    return failure(e);
  }
  revalidatePath(`/app/people/${id}`);
  await kick();
  return { ok: form.get("remove") === "1" ? "Photo removed." : "Photo saved." };
}

export async function importAction(_prev: PeopleState, form: FormData): Promise<PeopleState> {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { fieldErrors: { file: "Choose a CSV file." } };
  if (file.size > 5 * 1024 * 1024) return { fieldErrors: { file: "Choose a file under 5 MB." } };
  try {
    const imported = await importPeople(await ctx(), await file.text());
    revalidatePath("/app/people");
    await kick();
    return { imported };
  } catch (e) {
    return failure(e);
  }
}

export async function addFieldAction(_prev: PeopleState, form: FormData): Promise<PeopleState> {
  try {
    const f = await addCustomField(await ctx(), s(form, "label"), s(form, "sourceAttribute"));
    revalidatePath("/app/people");
    return { ok: `Added. Use it in signatures as {{custom.${f.key}}}.` };
  } catch (e) {
    return failure(e);
  }
}

export async function removeFieldAction(form: FormData) {
  await removeCustomField(await ctx(), s(form, "id"));
  revalidatePath("/app/people");
}

export async function socialsAction(_prev: PeopleState, form: FormData): Promise<PeopleState> {
  const id = String(form.get("id"));
  const input: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("social_")) input[k.slice(7)] = String(v);
  try {
    await setPersonSocials(await ctx(), id, input);
  } catch (e) {
    return failure(e);
  }
  await kick();
  revalidatePath(`/app/people/${id}`);
  return { ok: "Saved." };
}
