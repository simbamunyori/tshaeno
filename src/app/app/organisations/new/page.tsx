import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewOrganisationForm } from "./new-form";

export const metadata: Metadata = { title: "New organisation" };

export default function NewOrganisationPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="New organisation" />
      <Card className="sm:max-w-[520px]">
        <p className="mb-5 text-ink-muted">For another company or a client you manage signatures for. You become its owner, and it opens straight away.</p>
        <NewOrganisationForm />
      </Card>
    </div>
  );
}
