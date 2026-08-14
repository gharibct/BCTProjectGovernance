"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

// Shared Move Up / Move Down / Delete row, identical across all 3 block
// types so reordering/removing a block feels the same regardless of what
// kind of content it holds.
export function BlockActions({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Move block up"
        disabled={!canMoveUp}
        onClick={onMoveUp}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Move block down"
        disabled={!canMoveDown}
        onClick={onMoveDown}
      >
        <ChevronDown className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete block"
        onClick={onDelete}
      >
        <Trash2 className="size-4 text-slate-400" />
      </Button>
    </div>
  );
}
