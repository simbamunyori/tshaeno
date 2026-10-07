"use server";

import type { BrandFinding } from "@/lib/signature/brand-check";
import { reviewBrand } from "@/server/ai/signatures";
import { requestContext } from "@/server/auth/next";
import { DomainError } from "@/server/org/access";
import { requireMember } from "@/server/org/context";

export interface ReviewState {
  error?: string;
  findings?: BrandFinding[];
}

export async function brandReviewAction(): Promise<ReviewState> {
  const { organisation, actor } = await requireMember();
  try {
    return { findings: await reviewBrand({ organisationId: organisation.id, actor, ipAddress: (await requestContext()).ipAddress }) };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
}
