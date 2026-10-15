"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestContext } from "@/server/auth/next";
import { kickDelivery } from "@/server/jobs/queue";
import { quickStart } from "@/server/onboarding/service";
import { requireMember } from "@/server/org/context";

export async function quickStartAction(form: FormData) {
  const { organisation, actor } = await requireMember();
  const r = await quickStart({ organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress }, String(form.get("starter") ?? ""));
  await kickDelivery(organisation.id);
  revalidatePath("/app", "layout");
  redirect(`/app/start?applied=${r.everyone ? "everyone" : "1"}`);
}
