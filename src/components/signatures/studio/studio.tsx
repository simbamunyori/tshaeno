"use client";

import { Check, ClipboardCopy, Loader2, Plus, Users } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { publishAction, saveDraftAction, uploadImageAction } from "@/app/app/signatures/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { checkSignatureHtml } from "@/lib/signature/check";
import {
  BLOCK_LABEL,
  duplicateBlock,
  findBlock,
  insertBlock,
  listIn,
  moveBlock,
  newBlock,
  removeBlock,
  updateBlock,
  type Slot,
} from "@/lib/signature/doc";
import { SAMPLE_PERSON } from "@/lib/signature/fields";
import { renderHtmlSignature } from "@/lib/signature/html-mode";
import { renderSignature } from "@/lib/signature/render";
import type { Block, BlockType, BrandData, PersonData, SignatureDoc, TemplateContent } from "@/lib/signature/types";
import { ClientChecks } from "../client-checks";
import { PreviewToggles, SignatureFrame, type PreviewMode } from "../preview";
import { BLOCK_ICON, BlockList } from "./block-list";
import { Row, Select, Slider, smallInput } from "./controls";
import { HtmlEditor } from "./html-editor";
import { Inspector, type UploadedAsset } from "./inspector";

export interface StudioProps {
  template: {
    id: string;
    name: string;
    content: TemplateContent;
    brandKitId: string | null;
    publishedNumber: number | null;
    unpublishedChanges: boolean;
    archived: boolean;
  };
  kits: { id: string; name: string; isDefault: boolean; brand: BrandData }[];
  people: { id: string; label: string; person: PersonData }[];
  assets: UploadedAsset[];
  customFields: { key: string; label: string }[];
  origin: string;
  readOnly: boolean;
}

const ADDABLE: BlockType[] = ["text", "image", "contacts", "socials", "divider", "spacer", "button", "banner", "disclaimer", "columns"];

type SaveState = "saved" | "dirty" | "saving" | "error";

export function Studio(props: StudioProps) {
  const { template, kits, people, origin } = props;
  const readOnly = props.readOnly || template.archived;
  const [name, setName] = React.useState(template.name);
  const [doc, setDoc] = React.useState<SignatureDoc | null>(template.content.kind === "VISUAL" ? template.content.doc : null);
  const [html, setHtml] = React.useState(template.content.kind === "HTML" ? template.content.html : "");
  const [kitId, setKitId] = React.useState<string | null>(template.brandKitId);
  const [assets, setAssets] = React.useState(props.assets);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [personId, setPersonId] = React.useState<string>(people[0]?.id ?? "sample");
  const [mode, setMode] = React.useState<PreviewMode>({ dark: false, phone: false });
  const [save, setSave] = React.useState<SaveState>("saved");
  const [message, setMessage] = React.useState<{ tone: "positive" | "negative"; text: string } | null>(null);
  const [published, setPublished] = React.useState({ number: template.publishedNumber, pending: template.unpublishedChanges });
  const [publishing, setPublishing] = React.useState(false);
  const [tab, setTab] = React.useState<"edit" | "preview">("edit");
  const first = React.useRef(true);

  const kit = kits.find((k) => k.id === kitId) ?? kits.find((k) => k.isDefault) ?? kits[0];
  const person = people.find((p) => p.id === personId)?.person ?? SAMPLE_PERSON;
  const assetMap = React.useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);

  const rendered = React.useMemo(() => {
    if (!kit) return { html: "", text: "" };
    return doc ? renderSignature(doc, { brand: kit.brand, person, assets: assetMap, origin }) : renderHtmlSignature(html, { brand: kit.brand, person });
  }, [doc, html, kit, person, assetMap, origin]);
  const checks = React.useMemo(() => checkSignatureHtml(rendered.html), [rendered.html]);

  const payload = React.useCallback(() => ({ content: doc ?? { html }, name, brandKitId: kitId }), [doc, html, name, kitId]);

  // Save the draft a moment after each change.
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (readOnly) return;
    setSave("dirty");
    setPublished((p) => ({ ...p, pending: true }));
    const t = setTimeout(async () => {
      setSave("saving");
      const r = await saveDraftAction(template.id, payload());
      setSave(r.error ? "error" : "saved");
      if (r.error) setMessage({ tone: "negative", text: r.error });
    }, 1200);
    return () => clearTimeout(t);
  }, [payload, readOnly, template.id]);

  const publish = async () => {
    setPublishing(true);
    setMessage(null);
    const r = await publishAction(template.id, payload());
    setPublishing(false);
    if (r.error) return setMessage({ tone: "negative", text: r.error });
    setSave("saved");
    setPublished({ number: r.version ?? null, pending: false });
    setMessage({ tone: "positive", text: `${r.ok} Everyone it's given to now gets this version.` });
  };

  const upload = async (file: File, kind: "IMAGE" | "BANNER"): Promise<UploadedAsset | null> => {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    const r = await uploadImageAction(fd);
    if (r.error || !r.asset) {
      setMessage({ tone: "negative", text: r.error ?? "That image didn't upload. Try again." });
      return null;
    }
    setAssets((a) => [r.asset!, ...a]);
    return r.asset;
  };

  const add = (type: BlockType) => {
    if (!doc) return;
    const block = newBlock(type);
    const at = selected ? findBlock(doc, selected) : null;
    let slot: Slot = at?.slot ?? { parent: null };
    let index = at ? at.index + 1 : doc.blocks.length;
    // Two columns can't go inside a column; put them after it instead.
    if (type === "columns" && slot.parent) {
      const parent = findBlock(doc, slot.parent)!;
      slot = { parent: null };
      index = parent.index + 1;
    }
    setDoc(insertBlock(doc, block, slot, index));
    setSelected(block.id);
  };

  const selectedBlock = doc && selected ? findBlock(doc, selected)?.block : null;

  const copy = async () => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": new Blob([rendered.html], { type: "text/html" }), "text/plain": new Blob([rendered.text], { type: "text/plain" }) }),
      ]);
      setMessage({ tone: "positive", text: "Copied. Paste it into a mail client's signature settings." });
    } catch {
      setMessage({ tone: "negative", text: "Your browser didn't allow copying. Select the preview and copy it instead." });
    }
  };

  const saveLabel = { saved: "All changes saved", dirty: "Unsaved changes", saving: "Saving…", error: "Not saved" }[save];

  const editPanel = doc ? (
    <div className="flex flex-col gap-5">
      {readOnly ? null : (
        <div className="flex flex-col gap-2">
          <h2 className="text-callout font-semibold text-ink">Add a block</h2>
          <div className="grid grid-cols-2 gap-1.5">
            {ADDABLE.map((t) => {
              const Icon = BLOCK_ICON[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => add(t)}
                  className="flex h-9 items-center gap-2 rounded-md border border-border bg-surface-1 px-2.5 text-left text-callout text-ink hover:border-border-strong hover:bg-surface-2"
                >
                  <Plus aria-hidden className="size-3.5 text-ink-muted" />
                  <Icon aria-hidden className="size-4 text-link" />
                  <span className="truncate">{BLOCK_LABEL[t]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <h2 className="text-callout font-semibold text-ink">Blocks</h2>
        <p className="text-caption text-ink-muted">Drag the handle to reorder, or into a column. Select a block to change it.</p>
        <BlockList doc={doc} selected={selected} onSelect={setSelected} onMove={(id, to, index) => setDoc(moveBlock(doc, id, to, index))} readOnly={readOnly} />
      </div>
      <fieldset disabled={readOnly} className="flex flex-col gap-4 border-t border-border pt-4">
        <Slider label="Widest it gets" value={doc.width} min={280} max={640} step={10} onChange={(width) => setDoc({ ...doc, width })} />
        <Slider label="Base text size" value={doc.baseSize} min={11} max={16} onChange={(baseSize) => setDoc({ ...doc, baseSize })} />
      </fieldset>
    </div>
  ) : (
    <HtmlEditor value={html} onChange={setHtml} customFields={props.customFields} readOnly={readOnly} />
  );

  const previewPanel = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PreviewToggles mode={mode} onChange={setMode} />
        <Button variant="secondary" size="sm" onClick={copy}>
          <ClipboardCopy /> Copy signature
        </Button>
      </div>
      <div className={cn("rounded-lg p-3 sm:p-4", mode.dark ? "bg-[#111]" : "bg-surface-2")}>
        <SignatureFrame html={rendered.html} mode={mode} className="mx-auto" />
      </div>
      <ClientChecks result={checks} />
    </div>
  );

  const inspectorPanel = selectedBlock ? (
    <Inspector
      block={selectedBlock}
      colours={kit?.brand.colours ?? { primary: "#0B7F78", secondary: "#2EC4B6", text: "#0B1F3A", muted: "#5A6472" }}
      customFields={props.customFields}
      assets={assets}
      readOnly={readOnly}
      onChange={(patch: Partial<Block>) => doc && setDoc(updateBlock(doc, selectedBlock.id, patch))}
      onRemove={() => {
        if (!doc) return;
        setDoc(removeBlock(doc, selectedBlock.id));
        setSelected(null);
      }}
      onDuplicate={() => {
        if (!doc) return;
        const r = duplicateBlock(doc, selectedBlock.id);
        setDoc(r.doc);
        setSelected(r.id);
      }}
      onMove={(dir) => {
        if (!doc) return;
        const at = findBlock(doc, selectedBlock.id);
        if (!at) return;
        const len = listIn(doc, at.slot).length;
        const to = at.index + dir;
        if (to >= 0 && to < len) setDoc(moveBlock(doc, selectedBlock.id, at.slot, to));
      }}
      onUpload={upload}
    />
  ) : doc ? (
    <p className="text-callout text-ink-muted">Select a block in the list to change its text, colour, size or alignment.</p>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href="/app/signatures" className="text-callout text-ink-muted hover:text-ink">
            Signatures
          </Link>
          <label htmlFor="template-name" className="sr-only">
            Signature name
          </label>
          <input
            id="template-name"
            value={name}
            disabled={readOnly}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className="w-full min-w-0 rounded-md bg-transparent text-title-1 text-ink outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus)] disabled:opacity-100"
          />
          <p className="flex flex-wrap items-center gap-x-3 text-callout text-ink-muted" aria-live="polite">
            <span className="flex items-center gap-1">
              {save === "saving" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : save === "saved" ? <Check aria-hidden className="size-3.5" /> : null}
              {readOnly ? (template.archived ? "Archived, so it can't be changed" : "You can look, not change") : saveLabel}
            </span>
            <span>
              {published.number ? `Version ${published.number} is live${published.pending ? "; your newer changes aren't yet" : ""}` : "Not published yet"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={`/app/signatures/${template.id}/people`}>
              <Users /> Who gets it
            </Link>
          </Button>
          {readOnly ? null : (
            <Button onClick={publish} disabled={publishing || (!published.pending && !!published.number)}>
              {publishing ? "Publishing…" : published.number && !published.pending ? "Published" : "Publish"}
            </Button>
          )}
        </div>
      </div>

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Brand kit"
          value={kit?.id ?? ""}
          options={kits.map((k) => ({ value: k.id, label: k.isDefault ? `${k.name} (default)` : k.name }))}
          onChange={(v) => !readOnly && setKitId(v)}
        />
        <Row label="Preview as">
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} className={smallInput} aria-label="Preview as">
            <option value="sample">A sample person</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Row>
      </div>

      <div className="flex rounded-lg bg-surface-2 p-1 lg:hidden" role="tablist" aria-label="Studio">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("h-9 flex-1 rounded-md text-callout", tab === t ? "bg-surface-1 font-semibold text-ink shadow-sm" : "text-ink-muted")}
          >
            {t === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>

      <div className={cn("grid gap-6", doc ? "lg:grid-cols-[300px_minmax(0,1fr)_300px]" : "lg:grid-cols-2")}>
        <section aria-label="Edit" className={cn(tab === "edit" ? "flex" : "hidden", "flex-col gap-6 lg:flex")}>
          {editPanel}
          {doc ? <div className="rounded-lg border border-border bg-surface-1 p-4 lg:hidden">{inspectorPanel}</div> : null}
        </section>
        <section aria-label="Preview" className={cn(tab === "preview" ? "block" : "hidden", "lg:block")}>
          {previewPanel}
        </section>
        {doc ? (
          <aside aria-label="Block settings" className="hidden rounded-lg border border-border bg-surface-1 p-4 lg:block lg:self-start">
            {inspectorPanel}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
