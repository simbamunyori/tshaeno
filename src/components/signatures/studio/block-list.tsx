"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Columns2,
  Contact,
  GripVertical,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  MoveVertical,
  GalleryHorizontal,
  Scale,
  Share2,
  Type,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/cn";
import { BLOCK_LABEL, findBlock, listIn, slotKey, parseSlotKey, type Slot } from "@/lib/signature/doc";
import type { Block, BlockType, SignatureDoc } from "@/lib/signature/types";

export const BLOCK_ICON: Record<BlockType, LucideIcon> = {
  text: Type,
  image: ImageIcon,
  contacts: Contact,
  socials: Share2,
  divider: Minus,
  spacer: MoveVertical,
  button: MousePointerClick,
  banner: GalleryHorizontal,
  disclaimer: Scale,
  columns: Columns2,
};

function summary(b: Block): string {
  switch (b.type) {
    case "text":
      return b.text.split("\n")[0] || "Empty";
    case "image":
      return b.source === "logo" ? "Logo" : b.source === "photo" ? "Person's photo" : b.assetId ? "Uploaded image" : "No image chosen";
    case "contacts":
      return b.items.length ? `${b.items.length} details` : "Nothing chosen";
    case "socials":
      return "From the brand kit";
    case "divider":
      return `${b.thickness}px line`;
    case "spacer":
      return `${b.height}px`;
    case "button":
      return b.label;
    case "banner":
      return b.assetId ? "Uploaded banner" : "No image chosen";
    case "disclaimer":
      return "From the brand kit";
    case "columns":
      return `${b.left.length} left, ${b.right.length} right`;
  }
}

interface ListProps {
  doc: SignatureDoc;
  selected: string | null;
  onSelect: (id: string) => void;
  onMove: (blockId: string, to: Slot, index: number) => void;
  readOnly: boolean;
}

/**
 * Find the list under the pointer (a column before the main list), then
 * the nearest block in it. Gaps between blocks still land in the right
 * list, and an empty column takes a drop.
 */
const collision: CollisionDetection = (args) => {
  const draggingColumns = args.active.data.current?.type === "columns";
  const slots = args.droppableContainers.filter((c) => String(c.id).startsWith("slot:") && (!draggingColumns || c.id === "slot:root"));
  const inSlots = pointerWithin({ ...args, droppableContainers: slots });
  const slot = inSlots.find((h) => h.id !== "slot:root") ?? inSlots[0];
  if (!slot) return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => !String(c.id).startsWith("slot:")) });
  const items = args.droppableContainers.filter((c) => c.data.current?.slot === slot.id);
  if (!items.length) return [slot];
  return closestCenter({ ...args, droppableContainers: items });
};

export function BlockList({ doc, selected, onSelect, onMove, readOnly }: ListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [dragging, setDragging] = React.useState<Block | null>(null);

  const onDragStart = (e: DragStartEvent) => setDragging(findBlock(doc, String(e.active.id))?.block ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const overId = String(over.id);
    if (overId.startsWith("slot:")) {
      const slot = parseSlotKey(overId.slice(5));
      onMove(String(active.id), slot, listIn(doc, slot).length);
      return;
    }
    const target = findBlock(doc, overId);
    const from = findBlock(doc, String(active.id));
    if (!target || !from) return;
    if (slotKey(target.slot) === slotKey(from.slot)) return onMove(String(active.id), target.slot, target.index);
    // Into another list: before or after the block it was dropped on.
    const dragged = active.rect.current.translated;
    const below = dragged ? dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2 : false;
    onMove(String(active.id), target.slot, target.index + (below ? 1 : 0));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <Container slot={{ parent: null }} blocks={doc.blocks} depth={0} selected={selected} onSelect={onSelect} readOnly={readOnly} />
      <DragOverlay>{dragging ? <RowBody block={dragging} active dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function Container({ slot, blocks, depth, selected, onSelect, readOnly }: { slot: Slot; blocks: Block[]; depth: number; selected: string | null; onSelect: (id: string) => void; readOnly: boolean }) {
  const key = `slot:${slotKey(slot)}`;
  const { setNodeRef, isOver } = useDroppable({ id: key, disabled: readOnly });
  return (
    <SortableContext id={key} items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
      <ul ref={setNodeRef} className={cn("flex min-h-10 flex-col gap-1.5 rounded-md", depth > 0 && "border border-dashed border-border p-1.5", isOver && "bg-brand-soft/60")}>
        {blocks.map((b) => (
          <Item key={b.id} block={b} slot={key} depth={depth} selected={selected} onSelect={onSelect} readOnly={readOnly} />
        ))}
        {depth > 0 && !blocks.length ? <li className="px-2 py-2 text-caption text-ink-muted">Drag blocks here</li> : null}
      </ul>
    </SortableContext>
  );
}

function Item({ block, slot, depth, selected, onSelect, readOnly }: { block: Block; slot: string; depth: number; selected: string | null; onSelect: (id: string) => void; readOnly: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: { slot, type: block.type },
    disabled: readOnly,
  });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "opacity-40")}>
      <RowBody
        block={block}
        compact={depth > 0}
        active={selected === block.id}
        onSelect={() => onSelect(block.id)}
        handle={
          readOnly ? null : (
            <button
              ref={setActivatorNodeRef}
              type="button"
              aria-label={`Move ${BLOCK_LABEL[block.type]}`}
              className="flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-ink-muted hover:text-ink active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical aria-hidden className="size-4" />
            </button>
          )
        }
      />
      {block.type === "columns" ? (
        <div className="mt-1.5 grid gap-1.5 pl-6 sm:grid-cols-2">
          {(["left", "right"] as const).map((side) => (
            <div key={side} className="flex flex-col gap-1">
              <span className="text-caption font-semibold text-ink-muted">{side === "left" ? "Left" : "Right"}</span>
              <Container slot={{ parent: block.id, side }} blocks={block[side]} depth={depth + 1} selected={selected} onSelect={onSelect} readOnly={readOnly} />
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function RowBody({ block, active, onSelect, handle, dragging, compact }: { block: Block; active: boolean; onSelect?: () => void; handle?: React.ReactNode; dragging?: boolean; compact?: boolean }) {
  const Icon = BLOCK_ICON[block.type];
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md border bg-surface-1 pr-2",
        active ? "border-[var(--focus)] ring-1 ring-[var(--focus)]" : "border-border",
        !handle && "pl-2",
        dragging && "shadow-lg",
      )}
    >
      {handle}
      <button type="button" onClick={onSelect} aria-pressed={active} title={summary(block)} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left">
        <Icon aria-hidden className="size-4 shrink-0 text-link" />
        <span className={cn("text-callout font-semibold text-ink", compact ? "truncate" : "shrink-0")}>{BLOCK_LABEL[block.type]}</span>
        {compact ? null : <span className="truncate text-callout text-ink-muted">{summary(block)}</span>}
      </button>
    </div>
  );
}
