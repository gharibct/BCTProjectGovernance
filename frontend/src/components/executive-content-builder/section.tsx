"use client";

import * as React from "react";
import { FileStack, MoreVertical, Pencil, Plus, Table2, Trash2, Type } from "lucide-react";

import { SectionCard } from "@/components/forms/form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichTextBlockEditor } from "./blocks/rich-text-block";
import { ImageBlockEditor } from "./blocks/image-block";
import { TableBlockEditor } from "./blocks/table-block";
import { createBlock, resequence, type ExecutiveBlockType, type ExecutiveSection } from "./types";

const ADD_CONTENT_OPTIONS: { type: ExecutiveBlockType; label: string; icon: typeof Type }[] = [
  { type: "rich_text", label: "Rich Text", icon: Type },
  { type: "image", label: "Image", icon: FileStack },
  { type: "table", label: "Table", icon: Table2 },
];

export function Section({
  section,
  canMoveUp,
  canMoveDown,
  onChange,
  onRename,
  onMoveUp,
  onMoveDown,
  onDelete,
  onUploadImage,
  resolveImageUrl,
}: {
  section: ExecutiveSection;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (section: ExecutiveSection) => void;
  onRename: (title: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onUploadImage?: (file: File) => Promise<string>;
  resolveImageUrl?: (imageUrl: string) => Promise<string>;
}) {
  const [renaming, setRenaming] = React.useState(false);

  const updateBlocks = (blocks: ExecutiveSection["blocks"]) => {
    onChange({ ...section, blocks: resequence(blocks) });
  };

  const addBlock = (type: ExecutiveBlockType) => {
    updateBlocks([...section.blocks, createBlock(type, section.blocks.length + 1)]);
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const next = [...section.blocks];
    const target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];
    updateBlocks(next);
  };

  const deleteBlock = (index: number) => {
    updateBlocks(section.blocks.filter((_, i) => i !== index));
  };

  const updateBlock = (index: number, patch: Record<string, unknown>) => {
    updateBlocks(section.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  };

  return (
    <SectionCard
      icon={FileStack}
      title={renaming ? <SectionTitleInput title={section.title} onCommit={(t) => { onRename(t); setRenaming(false); }} /> : section.title}
      aside={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Section options">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              <Pencil className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canMoveUp} onSelect={onMoveUp}>
              Move Up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canMoveDown} onSelect={onMoveDown}>
              Move Down
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="flex flex-col gap-4">
        {section.blocks.map((block, index) => {
          const blockActions = {
            canMoveUp: index > 0,
            canMoveDown: index < section.blocks.length - 1,
            onMoveUp: () => moveBlock(index, -1),
            onMoveDown: () => moveBlock(index, 1),
            onDelete: () => deleteBlock(index),
          };
          if (block.type === "rich_text") {
            return (
              <RichTextBlockEditor
                key={block.id}
                block={block}
                onChange={(content) => updateBlock(index, { content })}
                {...blockActions}
              />
            );
          }
          if (block.type === "image") {
            return (
              <ImageBlockEditor
                key={block.id}
                block={block}
                onChange={(patch) => updateBlock(index, patch)}
                onUpload={onUploadImage}
                resolveImageUrl={resolveImageUrl}
                {...blockActions}
              />
            );
          }
          return (
            <TableBlockEditor
              key={block.id}
              block={block}
              onChange={(patch) => updateBlock(index, patch)}
              {...blockActions}
            />
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-fit">
              <Plus className="size-3.5" />
              Add Content
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {ADD_CONTENT_OPTIONS.map((option) => (
              <DropdownMenuItem key={option.type} onSelect={() => addBlock(option.type)}>
                <option.icon className="size-4" />
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SectionCard>
  );
}

// Swapped in for the section's title while renaming (triggered from the ⋮
// menu's "Rename" item) — owns its own draft text and commits on
// Enter/blur, cancels on Escape.
function SectionTitleInput({ title, onCommit }: { title: string; onCommit: (title: string) => void }) {
  const [draft, setDraft] = React.useState(title);
  const commit = () => {
    const trimmed = draft.trim();
    onCommit(trimmed || title);
  };
  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          onCommit(title);
        }
      }}
      className="h-9 max-w-xs text-base font-bold"
    />
  );
}
