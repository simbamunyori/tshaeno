"use client";

import { useState } from "react";
import { BackgroundCanvas, fileName, type CanvasDesign } from "@/components/backgrounds/background-canvas";

/** Pick anyone in the directory and download their copy, to send it to them. */
export function PersonDownload({ design, designName, people }: { design: CanvasDesign; designName: string; people: { id: string; name: string; title: string }[] }) {
  const [id, setId] = useState(people[0]?.id ?? "");
  const p = people.find((x) => x.id === id) ?? people[0];
  if (!p) return <p className="text-callout text-ink-muted">Add people to your directory to download their copies.</p>;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-sm flex-col gap-1.5 text-callout font-semibold text-ink">
        Person
        <select className="h-10 rounded-md border border-border-strong bg-surface-1 px-3 text-body font-normal text-ink" value={p.id} onChange={(e) => setId(e.target.value)}>
          {people.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <BackgroundCanvas design={design} name={p.name} title={p.title} download={fileName(p.name, designName)} className="max-w-xl" />
    </div>
  );
}
