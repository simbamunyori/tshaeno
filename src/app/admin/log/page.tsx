import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { platformLog } from "@/server/platform/service";
import { requireStaff } from "../staff";

export default async function StaffLog() {
  const staff = await requireStaff();
  const rows = await platformLog(staff);
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff log" />
      <p className="text-ink-muted">What Tshaeno staff did in this area. Nobody can edit or delete these records.</p>
      <Card className="p-0 sm:p-0">
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap gap-x-4 px-5 py-2 text-callout">
              <span className="w-[170px] text-ink-muted tabular-nums">{when.format(r.createdAt)}</span>
              <span className="flex-1 text-ink">{r.action}</span>
              <span className="text-ink-muted">{r.actorLabel}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
