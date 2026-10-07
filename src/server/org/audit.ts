import type { Prisma } from "@prisma/client";
import type { Tx } from "@/server/db";

export interface AuditActor {
  userId: string | null;
  name: string;
}

/** Appends one row to the organisation's audit trail, in the caller's transaction. */
export async function audit(
  tx: Tx,
  organisationId: string,
  actor: AuditActor,
  action: string,
  entity: { type: string; id: string },
  data?: Prisma.InputJsonValue,
  ipAddress?: string | null,
) {
  await tx.auditLog.create({
    data: {
      organisationId,
      actorUserId: actor.userId,
      actorLabel: actor.name,
      action,
      entityType: entity.type,
      entityId: entity.id,
      data,
      ipAddress: ipAddress ?? null,
    },
  });
}

/** Appends one row to the platform staff trail. */
export async function platformAudit(
  tx: Tx,
  actor: { userId: string; name: string },
  action: string,
  targetOrganisationId: string | null,
  data?: Prisma.InputJsonValue,
  ipAddress?: string | null,
) {
  await tx.platformAuditLog.create({
    data: {
      actorUserId: actor.userId,
      actorLabel: actor.name,
      action,
      targetOrganisationId,
      data,
      ipAddress: ipAddress ?? null,
    },
  });
}

/** Plain-language descriptions for the audit log page. */
export const ACTION_LABEL: Record<string, string> = {
  "organisation.created": "Created the organisation",
  "organisation.renamed": "Renamed the organisation",
  "organisation.suspended": "Suspended the organisation",
  "organisation.resumed": "Resumed the organisation",
  "member.invited": "Invited someone",
  "member.invitation_resent": "Sent an invitation again",
  "member.invitation_revoked": "Withdrew an invitation",
  "member.joined": "Joined",
  "member.role_changed": "Changed a role",
  "member.removed": "Removed someone",
  "auth.sign_in": "Signed in",
  "auth.sign_out": "Signed out",
  "auth.switched_organisation": "Opened this organisation",
  "auth.sign_in_failed": "A sign-in attempt failed",
  "auth.locked": "Sign-in paused after too many attempts",
  "auth.authenticator_set_up": "Set up an authenticator app",
  "auth.recovery_code_used": "Signed in with a backup code",
  "auth.identity_linked": "Linked a Google or Microsoft account",
  "auth.identity_unlinked": "Unlinked a Google or Microsoft account",
  "auth.passkey_added": "Added a passkey",
  "auth.passkey_removed": "Removed a passkey",
  "auth.email_confirmed": "Confirmed their email",
  "person.added": "Added someone to the directory",
  "person.updated": "Changed someone's directory details",
  "person.removed": "Removed someone from the directory",
  "person.photo_changed": "Changed someone's photo",
  "person.photo_removed": "Removed someone's photo",
  "directory.field_added": "Added a custom field",
  "directory.field_removed": "Removed a custom field",
  "directory.imported": "Imported people from a spreadsheet",
  "directory.synced": "Synced the directory",
  "connection.google_set_up": "Set up the Google Workspace connection",
  "connection.microsoft_consented": "Granted Microsoft 365 consent",
  "connection.changed": "Changed a connection's settings",
  "connection.removed": "Disconnected a directory",
  "outlook.addin_created": "Created the Outlook add-in",
  "outlook.addin_key_replaced": "Replaced the Outlook add-in key",
  "brand.created": "Created a brand kit",
  "brand.updated": "Changed a brand kit",
  "brand.logo_changed": "Changed a brand kit's logo",
  "brand.logo_removed": "Removed a brand kit's logo",
  "brand.made_default": "Made a brand kit the default",
  "brand.deleted": "Deleted a brand kit",
  "template.created": "Created a signature",
  "template.published": "Published a signature",
  "template.archived": "Archived a signature",
  "template.restored": "Restored a signature",
  "template.assigned": "Gave a signature to people",
  "template.unassigned": "Removed a signature rule",
  "asset.uploaded": "Uploaded an image",
};
