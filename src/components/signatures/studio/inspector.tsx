"use client";

import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Copy, ImagePlus, Trash2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BLOCK_LABEL } from "@/lib/signature/doc";
import { FIELDS } from "@/lib/signature/fields";
import { CONTACT_LABEL } from "@/lib/signature/render";
import type { Align, Block, BrandColours, ContactKind, ImageRef, TextSize } from "@/lib/signature/types";
import { ColourPicker, Row, Segmented, Select, Slider, Toggle, smallInput } from "./controls";

export interface UploadedAsset extends ImageRef {
  id: string;
  kind: string;
}

interface Props {
  block: Block;
  colours: BrandColours;
  customFields: { key: string; label: string }[];
  assets: UploadedAsset[];
  onChange: (patch: Partial<Block>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onUpload: (file: File, kind: "IMAGE" | "BANNER") => Promise<UploadedAsset | null>;
  readOnly: boolean;
}

const ALIGN = [
  { value: "left" as Align, label: <AlignLeft aria-hidden className="size-4" />, title: "Left" },
  { value: "center" as Align, label: <AlignCenter aria-hidden className="size-4" />, title: "Centre" },
  { value: "right" as Align, label: <AlignRight aria-hidden className="size-4" />, title: "Right" },
];

const SIZES: { value: TextSize; label: string }[] = [
  { value: "xs", label: "XS" },
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
  { value: "xl", label: "XL" },
];

function FieldText({ label, value, onChange, multiline, customFields }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; customFields: Props["customFields"] }) {
  const id = React.useId();
  const ref = React.useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const insert = (key: string) => {
    if (!key) return;
    const el = ref.current;
    const token = `{{${key}}}`;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const fields = [...FIELDS.map((f) => ({ key: f.key, label: f.label })), ...customFields.map((f) => ({ key: `custom.${f.key}`, label: f.label }))];
  return (
    <Row label={label} htmlFor={id} hint="Fields in double braces fill in for each person. A line whose fields are all empty is left out.">
      {multiline ? (
        <textarea id={id} ref={ref} value={value} rows={3} onChange={(e) => onChange(e.target.value)} className={cn(smallInput, "h-auto py-2 leading-5")} />
      ) : (
        <input id={id} ref={ref} value={value} onChange={(e) => onChange(e.target.value)} className={smallInput} />
      )}
      <select aria-label="Insert a field" value="" onChange={(e) => insert(e.target.value)} className={cn(smallInput, "w-auto self-start")}>
        <option value="">Insert a field…</option>
        {fields.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

function AssetPicker({ value, kind, assets, onPick, onUpload }: { value?: string; kind: "IMAGE" | "BANNER"; assets: UploadedAsset[]; onPick: (id: string) => void; onUpload: Props["onUpload"] }) {
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const mine = assets.filter((a) => a.kind === kind);
  return (
    <Row label="Image" hint="PNG, JPEG or GIF, up to 5 MB. Mail clients don't show SVG.">
      <div className="flex flex-wrap gap-2">
        {mine.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a.id)}
            aria-pressed={value === a.id}
            className={cn("flex h-14 w-20 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2", value === a.id && "ring-2 ring-[var(--focus)]")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.url} alt="" className="max-h-full max-w-full object-contain" />
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex h-14 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border-strong text-caption text-ink-muted hover:text-ink"
        >
          <ImagePlus aria-hidden className="size-4" />
          {busy ? "Uploading" : "Upload"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/gif"
          className="sr-only"
          tabIndex={-1}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true);
            const a = await onUpload(f, kind);
            setBusy(false);
            if (a) onPick(a.id);
          }}
        />
      </div>
    </Row>
  );
}

export function Inspector({ block, colours, customFields, assets, onChange, onRemove, onDuplicate, onMove, onUpload, readOnly }: Props) {
  const c = colours;
  const body = (() => {
    switch (block.type) {
      case "text":
        return (
          <>
            <FieldText label="Text" value={block.text} multiline customFields={customFields} onChange={(text) => onChange({ text })} />
            <Segmented label="Size" value={block.size} options={SIZES} onChange={(size) => onChange({ size })} />
            <div className="flex flex-wrap gap-4">
              <Toggle label="Bold" checked={block.bold} onChange={(bold) => onChange({ bold })} />
              <Toggle label="Italic" checked={block.italic} onChange={(italic) => onChange({ italic })} />
              <Toggle label="Capitals" checked={!!block.uppercase} onChange={(uppercase) => onChange({ uppercase })} />
            </div>
            <ColourPicker label="Colour" value={block.colour} colours={c} onChange={(colour) => onChange({ colour })} />
            <Segmented label="Alignment" value={block.align} options={ALIGN} onChange={(align) => onChange({ align })} />
          </>
        );
      case "image":
        return (
          <>
            <Select
              label="Show"
              value={block.source}
              options={[
                { value: "logo", label: "The brand kit's logo" },
                { value: "photo", label: "Each person's photo" },
                { value: "asset", label: "An image you upload" },
              ]}
              onChange={(source) => onChange({ source })}
            />
            {block.source === "asset" ? <AssetPicker value={block.assetId} kind="IMAGE" assets={assets} onPick={(assetId) => onChange({ assetId })} onUpload={onUpload} /> : null}
            {block.source === "photo" ? <p className="text-caption text-ink-muted">People without a photo get no image here.</p> : null}
            <Slider label="Width" value={block.width} min={24} max={300} onChange={(width) => onChange({ width })} />
            <Segmented
              label="Shape"
              value={block.shape}
              options={[
                { value: "square", label: "Square" },
                { value: "rounded", label: "Rounded" },
                { value: "circle", label: "Circle" },
              ]}
              onChange={(shape) => onChange({ shape })}
            />
            <FieldText label="Link" value={block.link} customFields={customFields} onChange={(link) => onChange({ link })} />
            <Segmented label="Alignment" value={block.align} options={ALIGN} onChange={(align) => onChange({ align })} />
          </>
        );
      case "banner":
        return (
          <>
            <AssetPicker value={block.assetId} kind="BANNER" assets={assets} onPick={(assetId) => onChange({ assetId })} onUpload={onUpload} />
            <Slider label="Width" value={block.width} min={120} max={600} onChange={(width) => onChange({ width })} />
            <FieldText label="Link" value={block.link} customFields={customFields} onChange={(link) => onChange({ link })} />
            <Row label="Description for when images are off">
              <input value={block.alt} onChange={(e) => onChange({ alt: e.target.value })} className={smallInput} maxLength={120} />
            </Row>
            <Segmented label="Alignment" value={block.align} options={ALIGN} onChange={(align) => onChange({ align })} />
          </>
        );
      case "contacts":
        return (
          <>
            <Row label="Show">
              <div className="flex flex-col gap-2">
                {(Object.keys(CONTACT_LABEL) as ContactKind[]).map((k) => (
                  <Toggle
                    key={k}
                    label={CONTACT_LABEL[k].label}
                    checked={block.items.includes(k)}
                    onChange={(on) =>
                      onChange({ items: on ? (Object.keys(CONTACT_LABEL) as ContactKind[]).filter((x) => x === k || block.items.includes(x)) : block.items.filter((x) => x !== k) })
                    }
                  />
                ))}
              </div>
              <p className="text-caption text-ink-muted">Empty details are left out for each person.</p>
            </Row>
            <Segmented
              label="Layout"
              value={block.layout}
              options={[
                { value: "stacked", label: "One per line" },
                { value: "inline", label: "On one line" },
              ]}
              onChange={(layout) => onChange({ layout })}
            />
            <Segmented
              label="Labels"
              value={block.labels}
              options={[
                { value: "icons", label: "Icons" },
                { value: "letters", label: "Letters" },
                { value: "none", label: "None" },
              ]}
              onChange={(labels) => onChange({ labels })}
            />
            <Segmented label="Size" value={block.size} options={SIZES} onChange={(size) => onChange({ size })} />
            <ColourPicker label="Text colour" value={block.colour} colours={c} onChange={(colour) => onChange({ colour })} />
            <ColourPicker label="Icon and label colour" value={block.accent} colours={c} onChange={(accent) => onChange({ accent })} />
            <Segmented label="Alignment" value={block.align} options={ALIGN} onChange={(align) => onChange({ align })} />
          </>
        );
      case "socials":
        return (
          <>
            <p className="text-callout text-ink-muted">The links come from the brand kit. A person&apos;s own link, such as their LinkedIn, can go in a custom field named after the network.</p>
            <Segmented
              label="Size"
              value={block.size}
              options={[
                { value: 16, label: "16" },
                { value: 20, label: "20" },
                { value: 24, label: "24" },
                { value: 28, label: "28" },
              ]}
              onChange={(size) => onChange({ size })}
            />
            <ColourPicker label="Colour" value={block.colour} colours={c} onChange={(colour) => onChange({ colour })} />
            <Segmented label="Alignment" value={block.align} options={ALIGN} onChange={(align) => onChange({ align })} />
          </>
        );
      case "divider":
        return (
          <>
            <ColourPicker label="Colour" value={block.colour} colours={c} onChange={(colour) => onChange({ colour })} />
            <Segmented
              label="Thickness"
              value={block.thickness}
              options={[1, 2, 3, 4].map((v) => ({ value: v as 1 | 2 | 3 | 4, label: `${v}px` }))}
              onChange={(thickness) => onChange({ thickness })}
            />
            <Slider label="Length" value={block.width} min={10} max={100} unit="%" onChange={(width) => onChange({ width })} />
            <Segmented label="Alignment" value={block.align} options={ALIGN} onChange={(align) => onChange({ align })} />
          </>
        );
      case "spacer":
        return <Slider label="Height" value={block.height} min={2} max={64} onChange={(height) => onChange({ height })} />;
      case "button":
        return (
          <>
            <Row label="Label">
              <input value={block.label} maxLength={60} onChange={(e) => onChange({ label: e.target.value })} className={smallInput} />
            </Row>
            <FieldText label="Link" value={block.url} customFields={customFields} onChange={(url) => onChange({ url })} />
            <ColourPicker label="Button colour" value={block.colour} colours={c} onChange={(colour) => onChange({ colour })} />
            <ColourPicker label="Label colour" value={block.textColour} colours={c} onChange={(textColour) => onChange({ textColour })} />
            <Toggle label="Rounded corners" checked={block.rounded} onChange={(rounded) => onChange({ rounded })} />
            <Segmented label="Alignment" value={block.align} options={ALIGN} onChange={(align) => onChange({ align })} />
          </>
        );
      case "disclaimer":
        return (
          <>
            <p className="text-callout text-ink-muted">The wording comes from the brand kit, so one change updates every signature.</p>
            <Segmented label="Size" value={block.size} options={SIZES} onChange={(size) => onChange({ size })} />
            <ColourPicker label="Colour" value={block.colour} colours={c} onChange={(colour) => onChange({ colour })} />
            <Segmented label="Alignment" value={block.align} options={ALIGN} onChange={(align) => onChange({ align })} />
          </>
        );
      case "columns":
        return (
          <>
            <p className="text-callout text-ink-muted">Drag blocks into the left or right column in the list.</p>
            <Slider label="Left column width" value={block.leftWidth} min={40} max={300} onChange={(leftWidth) => onChange({ leftWidth })} />
            <Slider label="Gap" value={block.gap} min={0} max={40} onChange={(gap) => onChange({ gap })} />
            <Toggle label="Line between the columns" checked={block.rule} onChange={(rule) => onChange({ rule })} />
            {block.rule ? <ColourPicker label="Line colour" value={block.ruleColour} colours={c} onChange={(ruleColour) => onChange({ ruleColour })} /> : null}
            <Segmented
              label="Line up"
              value={block.valign}
              options={[
                { value: "top", label: "Top" },
                { value: "middle", label: "Middle" },
              ]}
              onChange={(valign) => onChange({ valign })}
            />
          </>
        );
    }
  })();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-headline whitespace-nowrap text-ink">{BLOCK_LABEL[block.type]}</h3>
        {readOnly ? null : (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" aria-label="Move up" title="Move up" onClick={() => onMove(-1)}>
              <ArrowUp />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Move down" title="Move down" onClick={() => onMove(1)}>
              <ArrowDown />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Duplicate" title="Duplicate" onClick={onDuplicate}>
              <Copy />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Delete" title="Delete" onClick={onRemove} className="text-negative">
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
      <fieldset disabled={readOnly} className="flex flex-col gap-5">
        {body}
      </fieldset>
    </div>
  );
}
