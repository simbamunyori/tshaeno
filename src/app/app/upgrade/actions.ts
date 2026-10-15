"use server";

import type { FormState } from "@/components/ui/action-form";
import { requestContext } from "@/server/auth/next";
import { requestUpgrade } from "@/server/billing/service";
import { DomainError } from "@/server/org/access";
import { requireMember } from "@/server/org/context";

export async function requestUpgradeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { organisation, actor } = await requireMember();
  try {
    await requestUpgrade({ organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress }, String(form.get("feature") ?? "the full plan").slice(0, 60));
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  return { ok: "Thank you. We'll be in touch to move you to the full plan." };
}
