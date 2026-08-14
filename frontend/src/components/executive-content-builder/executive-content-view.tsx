"use client";

import { DollarSign, FileStack, Loader2, Settings, Truck, Users, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { sectionAccentColor } from "@/lib/section-accent-colors";
import { useResolvedImageUrl } from "./blocks/image-block";
import {
  RICH_TEXT_DISPLAY_CLASS,
  type ExecutiveContentBlock,
  type ExecutiveSection,
  type ExecutiveUpdate,
  type ImageBlock,
  type RichTextBlock,
  type TableBlock,
} from "./types";

// Read-only counterpart to ExecutiveContentBuilder — same section/block
// structure, no editing chrome (no ⋮ menu, no move/delete, no toolbars).
// Used to display a saved Executive Update wherever it's reviewed (e.g. the
// Geo Dashboard), as opposed to the editable form at
// components/regional-reporting/executive-update-view.tsx.

// Each section gets its own colored header band, PPT-section-divider style,
// so Delivery/People/Financials/... read as distinct topics at a glance
// instead of blending into one long scroll — colors come from the shared
// sectionAccentColor sequence (lib/section-accent-colors.ts), also used by
// the Geo Dashboard's Summary header above these sections.

// A fitting icon for each default section name; anything renamed/custom
// falls back to a generic one.
const SECTION_ICONS: Record<string, LucideIcon> = {
  Delivery: Truck,
  People: Users,
  Financials: DollarSign,
  Operations: Settings,
};

function isEmptyBlock(block: ExecutiveContentBlock): boolean {
  if (block.type === "rich_text") return !block.content || block.content === "<p></p>";
  if (block.type === "image") return !block.imageUrl;
  return false;
}

function RichTextBlockView({ block }: { block: RichTextBlock }) {
  return (
    <div
      className={cn("text-sm text-slate-800", RICH_TEXT_DISPLAY_CLASS)}
      dangerouslySetInnerHTML={{ __html: block.content }}
    />
  );
}

function ImageBlockView({
  block,
  resolveImageUrl,
}: {
  block: ImageBlock;
  resolveImageUrl?: (imageUrl: string) => Promise<string>;
}) {
  const { src, loading } = useResolvedImageUrl(block.imageUrl, resolveImageUrl);
  return (
    <figure className="flex flex-col gap-2">
      {loading ? (
        <div className="flex h-40 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          <Loader2 className="size-5 animate-spin text-slate-400" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- resolved via an authenticated fetch, not an optimizable remote image.
        <img
          src={src}
          alt={block.caption || "Executive Update image"}
          className="max-h-96 w-full rounded-lg border border-slate-200 object-contain"
        />
      )}
      {block.caption ? <figcaption className="text-sm text-slate-500">{block.caption}</figcaption> : null}
    </figure>
  );
}

function TableBlockView({ block }: { block: TableBlock }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            {block.columns.map((col, i) => (
              <th key={i} className="px-4 py-2 font-bold text-slate-700">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="px-4 py-2 text-slate-700">
                  {cell || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionView({
  section,
  index,
  resolveImageUrl,
}: {
  section: ExecutiveSection;
  index: number;
  resolveImageUrl?: (imageUrl: string) => Promise<string>;
}) {
  const visibleBlocks = section.blocks.filter((b) => !isEmptyBlock(b));
  const color = sectionAccentColor(index);
  const Icon = SECTION_ICONS[section.title] ?? FileStack;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        className={cn("flex items-center gap-3 px-6 py-4", color.text)}
        style={{ backgroundColor: color.bg }}
      >
        <Icon className="size-5 shrink-0" />
        <h2 className="text-lg font-bold tracking-wide">{section.title}</h2>
      </div>
      <div className="p-8">
        {visibleBlocks.length === 0 ? (
          <p className="text-sm text-slate-400">No content added for this section.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleBlocks.map((block) => {
              if (block.type === "rich_text") return <RichTextBlockView key={block.id} block={block} />;
              if (block.type === "image") {
                return <ImageBlockView key={block.id} block={block} resolveImageUrl={resolveImageUrl} />;
              }
              return <TableBlockView key={block.id} block={block} />;
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function ExecutiveContentView({
  value,
  resolveImageUrl,
}: {
  value: ExecutiveUpdate;
  resolveImageUrl?: (imageUrl: string) => Promise<string>;
}) {
  if (value.sections.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      {value.sections.map((section, index) => (
        <SectionView key={section.id} section={section} index={index} resolveImageUrl={resolveImageUrl} />
      ))}
    </div>
  );
}
