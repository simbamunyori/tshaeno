import type { Role } from "@prisma/client";

/** The person acting, as a member of the organisation. */
export interface Actor {
  membershipId: string;
  userId: string;
  name: string;
  role: Role;
}

export type Permission =
  | "view"
  | "manageMembers"
  | "manageOwners"
  | "manageOrganisation"
  | "manageBilling"
  | "manageTemplates"
  | "viewAnalytics"
  | "viewAudit";

const ALLOWED: Record<Permission, Role[]> = {
  view: ["OWNER", "ADMIN", "TEMPLATE_MANAGER", "ANALYST", "READ_ONLY"],
  /** Invite, change roles and remove people, except owners. */
  manageMembers: ["OWNER", "ADMIN"],
  /** Make someone an owner, or change or remove an owner. */
  manageOwners: ["OWNER"],
  /** Name, time zone and connections to Google and Microsoft. */
  manageOrganisation: ["OWNER", "ADMIN"],
  manageBilling: ["OWNER"],
  /** Signature templates, brand kits and rules (milestone S2 onward). */
  manageTemplates: ["OWNER", "ADMIN", "TEMPLATE_MANAGER"],
  viewAnalytics: ["OWNER", "ADMIN", "ANALYST", "READ_ONLY"],
  viewAudit: ["OWNER", "ADMIN", "READ_ONLY"],
};

export function can(actor: Pick<Actor, "role">, permission: Permission): boolean {
  return ALLOWED[permission].includes(actor.role);
}

export class DomainError extends Error {
  constructor(
    public readonly code: "forbidden" | "not-found" | "invalid" | "conflict",
    message: string,
    /** The form field the message belongs to, when there is one. */
    public readonly field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function assertCan(actor: Pick<Actor, "role">, permission: Permission): void {
  if (!can(actor, permission)) throw new DomainError("forbidden", "You don't have permission to do that.");
}

export const ROLES: Role[] = ["OWNER", "ADMIN", "TEMPLATE_MANAGER", "ANALYST", "READ_ONLY"];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  TEMPLATE_MANAGER: "Template manager",
  ANALYST: "Analyst",
  READ_ONLY: "Read-only",
};

export const ROLE_SUMMARY: Record<Role, string> = {
  OWNER: "Everything, including billing and other owners.",
  ADMIN: "Everything except billing and owners.",
  TEMPLATE_MANAGER: "Builds and assigns signatures and brand kits.",
  ANALYST: "Reads coverage and analytics.",
  READ_ONLY: "Sees everything, changes nothing.",
};

/** Which roles this person may give or take away. */
export function assignableRoles(actor: Pick<Actor, "role">): Role[] {
  if (can(actor, "manageOwners")) return ROLES;
  if (can(actor, "manageMembers")) return ROLES.filter((r) => r !== "OWNER");
  return [];
}
