"use client";

import type { Campaign } from "@prisma/client";
import { useState } from "react";
import { ActionFileField, ActionTextField } from "@/components/ui/action-form";
import { SelectField } from "@/components/ui/inputs";
import { toLocalInput } from "@/lib/zoned-time";

const SCOPE_OPTIONS = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "DEPARTMENT", label: "One department" },
  { value: "LOCATION", label: "One office" },
  { value: "GROUP", label: "One group" },
];
const AUDIENCE_OPTIONS = [
  { value: "EXTERNAL", label: "Emails to people outside the organisation" },
  { value: "INTERNAL", label: "Emails inside the organisation" },
  { value: "ANY", label: "All emails" },
];
const TARGET_LABEL: Record<string, string> = { DEPARTMENT: "Department", LOCATION: "Office", GROUP: "Group" };

/** The campaign form's fields, inside an ActionForm. */
export function CampaignFields({
  campaign,
  timeZone,
  options,
}: {
  campaign: Campaign | null;
  timeZone: string;
  options: { DEPARTMENT: string[]; LOCATION: string[]; GROUP: string[] };
}) {
  const [scope, setScope] = useState<string>(campaign?.scope ?? "EVERYONE");
  const current = campaign ? (campaign.scope === "DEPARTMENT" ? campaign.department : campaign.scope === "LOCATION" ? campaign.location : campaign.groupName) : "";
  return (
    <>
      {campaign ? <input type="hidden" name="id" value={campaign.id} /> : null}
      <ActionTextField id="name" label="Name" defaultValue={campaign?.name} placeholder="Winter sale" hint="Only you see this, in the reports." />
      <ActionFileField
        id="file"
        label={campaign ? "New picture (optional)" : "Banner picture"}
        accept="image/png,image/jpeg,image/gif"
        hint="PNG, JPEG or GIF. About 1200 by 300 pixels looks sharp on every screen."
      />
      <ActionTextField id="linkUrl" label="Where it goes" type="url" inputMode="url" defaultValue={campaign?.linkUrl} placeholder="https://example.com/offer" />
      <ActionTextField id="alt" label="Description" defaultValue={campaign?.alt} placeholder="Winter sale: 20% off until 31 July" hint="Shown when pictures are turned off, and read out by screen readers." />
      <ActionTextField id="width" label="Width in pixels" inputMode="numeric" defaultValue={String(campaign?.width ?? 480)} hint="200 to 600. Most signatures are about 480 wide." />
      <div className="grid gap-4 sm:grid-cols-2">
        <ActionTextField id="startsAt" label="Starts" type="datetime-local" defaultValue={toLocalInput(campaign?.startsAt, timeZone)} hint="Leave empty to start now." />
        <ActionTextField id="endsAt" label="Ends" type="datetime-local" defaultValue={toLocalInput(campaign?.endsAt, timeZone)} hint="Leave empty to run until you end it." />
      </div>
      <SelectField id="scope" label="Who shows it" options={SCOPE_OPTIONS} value={scope} onChange={(e) => setScope(e.target.value)} />
      {(["DEPARTMENT", "LOCATION", "GROUP"] as const).map((k) =>
        scope === k ? (
          <div key={k}>
            <ActionTextField id={`target_${k}`} label={TARGET_LABEL[k]} list={`list_${k}`} defaultValue={campaign?.scope === k ? (current ?? "") : ""} />
            <datalist id={`list_${k}`}>
              {options[k].map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
        ) : null,
      )}
      <SelectField id="audience" label="In which emails" options={AUDIENCE_OPTIONS} defaultValue={campaign?.audience ?? "EXTERNAL"} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-callout font-semibold text-ink">On</legend>
        <label className="flex items-center gap-3 text-body text-ink">
          <input type="checkbox" name="forNew" defaultChecked={campaign?.forNew ?? true} className="size-4 accent-[var(--brand)]" />
          New emails
        </label>
        <label className="flex items-center gap-3 text-body text-ink">
          <input type="checkbox" name="forReply" defaultChecked={campaign?.forReply ?? false} className="size-4 accent-[var(--brand)]" />
          Replies and forwards <span className="text-callout text-ink-muted">Outlook only; Gmail has one signature for both.</span>
        </label>
      </fieldset>
    </>
  );
}
