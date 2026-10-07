import "server-only";
import { notFound } from "next/navigation";
import { requireActiveSession } from "@/server/auth/next";
import type { StaffMember } from "@/server/platform/service";

/** Tshaeno staff only. Everyone else gets a plain "not found". */
export async function requireStaff(): Promise<StaffMember> {
  const session = await requireActiveSession();
  if (!session.user.isPlatformAdmin) notFound();
  return { userId: session.userId, name: session.user.name, isPlatformAdmin: true };
}
