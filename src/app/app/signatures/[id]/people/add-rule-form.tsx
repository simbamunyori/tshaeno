"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/inputs";
import { addAssignmentAction, type ActionResult } from "../../actions";

type Option = { value: string; label: string };

export function AddRuleForm({ templateId, departments, people }: { templateId: string; departments: string[]; people: Option[] }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(addAssignmentAction, {});
  const [scope, setScope] = useState("EVERYONE");
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="templateId" value={templateId} />
      {state.ok ? <Alert tone="positive">{state.ok}</Alert> : state.error ? <Alert>{state.error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="scope"
          label="Who"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          options={[
            { value: "EVERYONE", label: "Everyone" },
            { value: "DEPARTMENT", label: "A department" },
            { value: "PERSON", label: "One person" },
          ]}
        />
        {scope === "DEPARTMENT" ? (
          <SelectField
            id="department"
            label="Department"
            options={departments.map((d) => ({ value: d, label: d }))}
            placeholder={departments.length ? "Choose a department" : "No departments in the directory yet"}
            error={state.fieldErrors?.department}
          />
        ) : scope === "PERSON" ? (
          <SelectField id="personId" label="Person" options={people} placeholder={people.length ? "Choose someone" : "Nobody in the directory yet"} error={state.fieldErrors?.personId} />
        ) : (
          <div className="hidden sm:block" />
        )}
        <SelectField
          id="usage"
          label="Use it for"
          defaultValue="both"
          options={[
            { value: "both", label: "New emails and replies" },
            { value: "new", label: "New emails only" },
            { value: "reply", label: "Replies and forwards only" },
          ]}
        />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add rule"}
        </Button>
      </div>
    </form>
  );
}
