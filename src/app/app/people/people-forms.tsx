"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, inputClass, TextField } from "@/components/ui/field";
import { addFieldAction, importAction, photoAction, savePersonAction, type PeopleState } from "./actions";

export interface PersonValues {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  department: string;
  phone: string;
  mobile: string;
  custom: Record<string, string>;
}

export function PersonForm({ person, customFields, departments, readOnly }: { person?: PersonValues; customFields: { key: string; label: string }[]; departments: string[]; readOnly?: boolean }) {
  const [state, action, pending] = useActionState<PeopleState, FormData>(savePersonAction, {});
  const v = (k: string, fallback = "") => state.values?.[k] ?? fallback;
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {person?.id ? <input type="hidden" name="id" value={person.id} /> : null}
      {state.ok ? <Alert tone="positive">{state.ok}</Alert> : state.error ? <Alert>{state.error}</Alert> : null}
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <TextField id="firstName" label="First name" autoComplete="off" defaultValue={v("firstName", person?.firstName)} error={e.firstName} required />
        <TextField id="lastName" label="Last name" autoComplete="off" defaultValue={v("lastName", person?.lastName)} />
        <TextField id="email" label="Email" type="email" inputMode="email" autoComplete="off" defaultValue={v("email", person?.email)} error={e.email} required />
        <TextField id="title" label="Job title" autoComplete="off" defaultValue={v("title", person?.title)} />
        <TextField id="department" label="Department" autoComplete="off" list="departments" defaultValue={v("department", person?.department)} />
        <datalist id="departments">
          {departments.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <TextField id="phone" label="Phone" type="tel" autoComplete="off" defaultValue={v("phone", person?.phone)} />
        <TextField id="mobile" label="Mobile" type="tel" autoComplete="off" defaultValue={v("mobile", person?.mobile)} />
        {customFields.map((f) => (
          <TextField key={f.key} id={`custom.${f.key}`} label={f.label} autoComplete="off" defaultValue={v(`custom.${f.key}`, person?.custom[f.key])} hint={`{{custom.${f.key}}}`} />
        ))}
      </fieldset>
      {readOnly ? null : (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : person?.id ? "Save changes" : "Add person"}
          </Button>
        </div>
      )}
    </form>
  );
}

export function PhotoForm({ id, hasPhoto }: { id: string; hasPhoto: boolean }) {
  const [state, action, pending] = useActionState<PeopleState, FormData>(photoAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {state.ok ? <Alert tone="positive">{state.ok}</Alert> : state.error ? <Alert>{state.error}</Alert> : null}
      <Field id="file" label="Photo" error={state.fieldErrors?.file} hint="A square crop is made around the face. PNG, JPEG or GIF.">
        {(describedBy, invalid) => <input id="file" name="file" type="file" accept="image/png,image/jpeg,image/gif" aria-describedby={describedBy} aria-invalid={invalid || undefined} className="text-callout text-ink" />}
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Uploading…" : "Upload photo"}
        </Button>
        {hasPhoto ? (
          <Button type="submit" size="sm" variant="secondary" name="remove" value="1" disabled={pending}>
            Remove photo
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function ImportForm() {
  const [state, action, pending] = useActionState<PeopleState, FormData>(importAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.imported) form.current?.reset();
  }, [state]);
  const r = state.imported;
  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      {r ? (
        <Alert tone={r.skipped.length ? "warning" : "positive"}>
          Added {r.added}, updated {r.updated}
          {r.skipped.length ? `, skipped ${r.skipped.length}.` : "."}
          {r.skipped.length ? (
            <ul className="mt-2 list-disc pl-4">
              {r.skipped.slice(0, 10).map((s) => (
                <li key={s.row}>
                  Row {s.row}: {s.reason}
                </li>
              ))}
              {r.skipped.length > 10 ? <li>And {r.skipped.length - 10} more.</li> : null}
            </ul>
          ) : null}
        </Alert>
      ) : state.error ? (
        <Alert>{state.error}</Alert>
      ) : null}
      <Field id="csv" label="CSV file" error={state.fieldErrors?.file} hint="Columns we recognise: Email, First name, Last name or Name, Job title, Department, Phone, Mobile, and your custom fields by name. People are matched on email, so importing again updates them.">
        {(describedBy, invalid) => <input id="csv" name="file" type="file" accept=".csv,text/csv" aria-describedby={describedBy} aria-invalid={invalid || undefined} className="text-callout text-ink" />}
      </Field>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Importing…" : "Import"}
        </Button>
      </div>
    </form>
  );
}

export function AddFieldForm() {
  const [state, action, pending] = useActionState<PeopleState, FormData>(addFieldAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      {state.ok ? <Alert tone="positive">{state.ok}</Alert> : state.error ? <Alert>{state.error}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <Field id="label" label="New field" error={state.fieldErrors?.label} className="min-w-0 flex-1">
          {(describedBy, invalid) => <input id="label" name="label" placeholder="For example, Pronouns or LinkedIn" aria-describedby={describedBy} aria-invalid={invalid || undefined} className={inputClass} />}
        </Field>
        <Button type="submit" variant="secondary" disabled={pending} size="lg">
          Add field
        </Button>
      </div>
    </form>
  );
}
