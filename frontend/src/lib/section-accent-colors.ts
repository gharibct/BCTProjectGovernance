// Validated categorical palette (dataviz skill's references/palette.md) for
// coloring topic-based section headers PPT-divider style. Shared by the
// Executive Update content view (Delivery/People/Financials/Operations) and
// the Geo Dashboard's Summary header so they read as one consistent visual
// language. Assigned by position, not by title, so it stays sensible if
// sections are renamed, reordered, or added to. This exact 8-color order
// clears every *adjacent*-pair colorblind-safety gate (worst adjacent CVD
// ΔE 9.1 light / 8.4 dark, ≥8 target) — the case that matters here, since
// these headers only ever sit next to their immediate neighbors on the page.
export type SectionAccentColor = { bg: string; text: string };

export const SECTION_ACCENT_COLORS: SectionAccentColor[] = [
  { bg: "#2a78d6", text: "text-white" }, // blue
  { bg: "#eb6834", text: "text-white" }, // orange
  { bg: "#1baf7a", text: "text-white" }, // aqua
  { bg: "#eda100", text: "text-slate-900" }, // yellow — dark text, too light for white
  { bg: "#e87ba4", text: "text-white" }, // magenta
  { bg: "#008300", text: "text-white" }, // green
  { bg: "#4a3aa7", text: "text-white" }, // violet
  { bg: "#e34948", text: "text-white" }, // red
];

export function sectionAccentColor(index: number): SectionAccentColor {
  return SECTION_ACCENT_COLORS[index % SECTION_ACCENT_COLORS.length];
}
