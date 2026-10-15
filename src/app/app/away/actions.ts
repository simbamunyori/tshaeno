"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/ui/action-form";
import { fromLocalInput } from "@/lib/zoned-time";
import { requestContext } from "@/server/auth/next";
import { cancelAway, setAway } from "@/server/away/service";
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

export async function setAwayAction(_prev: FormState, form: FormData): Promise<FormState> {
  const c = await ctx();
  const s = (k: string) => String(form.get(k) ?? "");
  let a;
  try {
    a = await setAway(c, {
      personId: s("personId"),
      reason: s("reason"),
      startsAt: fromLocalInput(s("startsAt"), c.timeZone),
      endsAt: fromLocalInput(s("endsAt"), c.timeZone),
      subject: s("subject"),
      message: s("message"),
      withSignature: s("withSignature") === "on",
    });
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/app/away");
  if (a.status === "SET") return { ok: `Set in ${a.mailbox}. It switches itself on and off on those dates.` };
  if (a.status === "SAVED") return { ok: "Saved. Tshaeno can't reach this mailbox, so copy the message from the list below into their mail app." };
  return { error: `Saved, but ${a.mailbox ?? "the mailbox"} didn't accept it: ${a.lastError ?? "unknown problem"}` };
}

export async function cancelAwayAction(_prev: FormState, form: FormData): Promise<FormState> {
  let a;
  try {
    a = await cancelAway(await ctx(), String(form.get("id") ?? ""));
  } catch (e) {
    return failure(e);
  }
  revalidatePath("/app/away");
  return a.lastError ? { error: a.lastError } : { ok: "Cancelled." };
}
