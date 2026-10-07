"use server";

import { revalidatePath } from "next/cache";
import { requestContext } from "@/server/auth/next";
import { DomainError } from "@/server/org/access";
import { setOrganisationStatus } from "@/server/platform/service";
import { requireStaff } from "./staff";

export interface StatusState {
  error?: string;
}

export async function setStatusAction(_prev: StatusState, form: FormData): Promise<StatusState> {
  const staff = await requireStaff();
  const id = String(form.get("id"));
  const status = form.get("status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  try {
    await setOrganisationStatus(staff, id, status, String(form.get("reason") ?? ""), (await requestContext()).ipAddress);
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/organisations/${id}`);
  return {};
}
