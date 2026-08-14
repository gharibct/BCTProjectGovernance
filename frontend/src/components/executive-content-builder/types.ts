// Structured content model for an Executive Update — sections of business
// content (Delivery, People, Financials, ...), each holding an ordered list
// of content blocks. Deliberately NOT one HTML blob: every block is typed
// and structured so a future backend can store/validate it, and so each
// block type gets its own purpose-built editing UI instead of a single
// free-form document surface.

export type ExecutiveBlockType = "rich_text" | "image" | "table";

// No @tailwindcss/typography plugin in this project, so a `prose` class does
// nothing and Tailwind's own preflight reset strips default <ul>/<ol>/<h2>/
// <h3> styling — this styles the elements Tiptap's HTML output actually
// contains, shared by both the editor (rich-text-block.tsx) and the
// read-only display (executive-content-view.tsx) so they render identically.
export const RICH_TEXT_DISPLAY_CLASS =
  "[&_p]:my-2 [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900 " +
  "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 " +
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_li]:my-0.5 [&_a]:text-[#1a6fc4] [&_a]:underline";

export type RichTextBlock = {
  id: string;
  type: "rich_text";
  sequence: number;
  content: string; // Tiptap HTML output
};

export type ImageBlock = {
  id: string;
  type: "image";
  sequence: number;
  imageUrl: string;
  caption: string;
};

export type TableBlock = {
  id: string;
  type: "table";
  sequence: number;
  columns: string[];
  rows: string[][];
};

export type ExecutiveContentBlock = RichTextBlock | ImageBlock | TableBlock;

export type ExecutiveSection = {
  id: string;
  title: string;
  sequence: number;
  blocks: ExecutiveContentBlock[];
};

export type ExecutiveUpdate = {
  sections: ExecutiveSection[];
};

function makeId(): string {
  return crypto.randomUUID();
}

export function createSection(title: string, sequence: number): ExecutiveSection {
  return { id: makeId(), title, sequence, blocks: [] };
}

export function createBlock(type: ExecutiveBlockType, sequence: number): ExecutiveContentBlock {
  const id = makeId();
  switch (type) {
    case "rich_text":
      return { id, type, sequence, content: "" };
    case "image":
      return { id, type, sequence, imageUrl: "", caption: "" };
    case "table":
      return {
        id,
        type,
        sequence,
        columns: ["Metric", "Value"],
        rows: [["", ""]],
      };
  }
}

// Renumbers `sequence` to match array order — called after every
// add/move/delete so a future backend can sort by `sequence` alone.
export function resequence<T extends { sequence: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, sequence: index + 1 }));
}
