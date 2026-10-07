import * as React from "react";
import { cn } from "@/lib/cn";
import { Field, inputClass } from "./field";

interface BaseProps {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
}

/** A native select drawn like the other inputs, with a chevron. */
export const selectClass = "appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10";
export const selectStyle: React.CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A94A3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
};

export function SelectField({
  id,
  label,
  hint,
  error,
  className,
  options,
  placeholder,
  ...props
}: BaseProps & {
  options: { value: string; label: string }[];
  placeholder?: string;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "id">) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      {(describedBy, invalid) => (
        <select
          id={id}
          name={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(inputClass, selectClass)}
          style={selectStyle}
          {...props}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
