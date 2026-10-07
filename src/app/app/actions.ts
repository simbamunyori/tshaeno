"use server";

import { redirect } from "next/navigation";
import { authDeps, requestContext, requireActiveSession } from "@/server/auth/next";
import { AuthError, switchOrganisation } from "@/server/auth/service";

export async function switchOrganisationAction(form: FormData) {
  const session = await requireActiveSession();
  const id = form.get("organisationId");
  if (typeof id !== "string") redirect("/app");
  try {
    await switchOrganisation(authDeps(), session, id, await requestContext());
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
  }
  redirect("/app");
}
