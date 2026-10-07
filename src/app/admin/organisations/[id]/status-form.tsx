"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { setStatusAction, type StatusState } from "../../actions";

export function StatusForm({ id, suspended }: { id: string; suspended: boolean }) {
  const [state, action, pending] = useActionState<StatusState, FormData>(setStatusAction, {});
  return (
    <form action={action} className="flex flex-col gap-4 sm:max-w-[520px]">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={suspended ? "ACTIVE" : "SUSPENDED"} />
      <TextField id="reason" label="Reason" required hint="Recorded in the staff log and in the organisation's own audit log." />
      <Button type="submit" variant={suspended ? "primary" : "destructive"} disabled={pending} className="self-start">
        {suspended ? "Resume organisation" : "Suspend organisation"}
      </Button>
    </form>
  );
}
