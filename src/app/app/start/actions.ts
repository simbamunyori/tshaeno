"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requestContext } from "@/server/auth/next";
import { kickDelivery } from "@/server/jobs/queue";
import { quickStart } from "@/server/onboarding/service";
import { requireMember } from "@/server/org/context";
import { PICKED_TEMPLATE_COOKIE } from "@/server/site";

export async function quickStartAction(form: FormData) {
  const { organisation, actor } = await requireMember();
  const r = await quickStart({ organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress }, String(form.get("starter") ?? ""));
  await kickDelivery(organisation.id);
  (await cookies()).delete(PICKED_TEMPLATE_COOKIE);
  revalidatePath("/app", "layout");
  redirect(`/app/start?applied=${r.everyone ? "everyone" : "1"}`);
}
