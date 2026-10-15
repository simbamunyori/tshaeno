"use server";

import type { FormState } from "@/components/ui/action-form";
import { requestContext } from "@/server/auth/next";
import { requestDemo } from "@/server/demo";
import { DomainError } from "@/server/org/access";

const s = (form: FormData, k: string) => String(form.get(k) ?? "");

export async function requestDemoAction(_prev: FormState, form: FormData): Promise<FormState> {
  // A field people can't see. Anything that fills it in is a bot; say thanks and do nothing.
  if (s(form, "website")) return { ok: "Thank you." };
  try {
    await requestDemo(
      { name: s(form, "name"), email: s(form, "email"), company: s(form, "company"), people: s(form, "people"), phone: s(form, "phone"), message: s(form, "message") },
      (await requestContext()).ipAddress ?? null,
    );
    return { ok: "Thank you. Someone from our team will email you shortly to find a time that suits you." };
  } catch (e) {
    if (e instanceof DomainError) return e.field ? { fieldErrors: { [e.field]: e.message } } : { error: e.message };
    throw e;
  }
}
