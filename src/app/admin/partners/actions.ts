"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/ui/action-form";
import { requestContext } from "@/server/auth/next";
import { env } from "@/server/env";
import { DomainError } from "@/server/org/access";
import { createPartner, rotateSecret, updatePartner } from "@/server/partner/service";
import { requireStaff } from "../staff";

export interface SecretState {
  error?: string;
  partnerId?: string;
  keyId?: string;
  secret?: string;
}

export async function createPartnerAction(_prev: SecretState, form: FormData): Promise<SecretState> {
  const staff = await requireStaff();
  try {
    const { partner, secret } = await createPartner(staff, String(form.get("name") ?? ""), env().TOTP_ENCRYPTION_KEY, (await requestContext()).ipAddress);
    revalidatePath("/admin/partners");
    return { partnerId: partner.id, keyId: partner.keyId, secret };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
}

export async function rotateSecretAction(_prev: SecretState, form: FormData): Promise<SecretState> {
  const staff = await requireStaff();
  const id = String(form.get("id"));
  const secret = await rotateSecret(staff, id, env().TOTP_ENCRYPTION_KEY, (await requestContext()).ipAddress);
  revalidatePath(`/admin/partners/${id}`);
  return { partnerId: id, secret };
}

export async function updatePartnerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const id = String(form.get("id"));
  const s = (k: string) => String(form.get(k) ?? "");
  try {
    await updatePartner(
      staff,
      id,
      { name: s("name"), allowedIps: s("allowedIps"), wholesaleDiscountPercent: s("wholesaleDiscountPercent"), active: form.get("active") === "on" },
      (await requestContext()).ipAddress,
    );
  } catch (e) {
    if (e instanceof DomainError) return e.field ? { fieldErrors: { [e.field]: e.message } } : { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/partners/${id}`);
  return { ok: "Saved." };
}
