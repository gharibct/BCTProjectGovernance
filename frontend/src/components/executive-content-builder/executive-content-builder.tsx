"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Section } from "./section";
import { createSection, resequence, type ExecutiveUpdate } from "./types";

// Pure controlled component over the ExecutiveUpdate JSON shape — no
// internal data state, every mutation flows out through `onChange`. Reusable
// anywhere a caller wants "business sections of Rich Text / Image / Table
// content blocks" (currently: the Geo Head's Executive Update for CXO).
export function ExecutiveContentBuilder({
  value,
  onChange,
  onUploadImage,
  resolveImageUrl,
}: {
  value: ExecutiveUpdate;
  onChange: (value: ExecutiveUpdate) => void;
  // Optional image-persistence hooks — omit both to keep image blocks fully
  // local (blob: URL preview only, no backend). A caller that has somewhere
  // to store images (see executive-update-view.tsx) passes both.
  onUploadImage?: (file: File) => Promise<string>;
  resolveImageUrl?: (imageUrl: string) => Promise<string>;
}) {
  const updateSections = (sections: ExecutiveUpdate["sections"]) => {
    onChange({ sections: resequence(sections) });
  };

  const addSection = () => {
    updateSections([...value.sections, createSection(`Section ${value.sections.length + 1}`, value.sections.length + 1)]);
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const next = [...value.sections];
    const target = index + direction;
    [next[index], next[target]] = [next[target], next[index]];
    updateSections(next);
  };

  const deleteSection = (index: number) => {
    updateSections(value.sections.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-6">
      {value.sections.map((section, index) => (
        <Section
          key={section.id}
          section={section}
          canMoveUp={index > 0}
          canMoveDown={index < value.sections.length - 1}
          onChange={(next) => updateSections(value.sections.map((s, i) => (i === index ? next : s)))}
          onRename={(title) =>
            updateSections(value.sections.map((s, i) => (i === index ? { ...s, title } : s)))
          }
          onMoveUp={() => moveSection(index, -1)}
          onMoveDown={() => moveSection(index, 1)}
          onDelete={() => deleteSection(index)}
          onUploadImage={onUploadImage}
          resolveImageUrl={resolveImageUrl}
        />
      ))}

      <Button type="button" variant="outline" onClick={addSection} className="w-fit">
        <Plus className="size-4" />
        Add Section
      </Button>
    </div>
  );
}

export * from "./types";
