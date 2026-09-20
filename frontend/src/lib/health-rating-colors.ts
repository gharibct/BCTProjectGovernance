// Single source of truth for the four RAG health colors (Green/Amber/
// Potential Red/Red). This used to be copy-pasted independently across
// health-declaration.tsx (x2), project-health-kpi.tsx, and several dashboard
// list/queue components, each drifting to slightly different shades — which
// is why Red/Potential Red/Amber ended up looking near-identical in some
// views. Every consumer should import from here rather than defining its own
// bg-*/text-* classes.
export type HealthRatingKey = "green" | "amber" | "potential-red" | "red";

// Matches the API's HealthRating enum literal casing (see lib/api/projects.ts).
export type HealthRatingApiLabel = "Green" | "Amber" | "Potential Red" | "Red";

interface HealthColorSet {
  // Solid bg + text — badges, pills, selected-state buttons, large blocks.
  solid: string;
  // Bg only, for small dot indicators sized by the caller's className.
  dot: string;
}

// Brand hex values (not stock Tailwind shades) — picked to keep Amber/
// Potential Red/Red clearly distinct hues rather than adjacent warm tones.
export const HEALTH_RATING_HEX: Record<HealthRatingKey, string> = {
  green: "#22A447",
  amber: "#F5A623",
  "potential-red": "#F05A28",
  red: "#A6192E",
};

export const HEALTH_RATING_COLORS: Record<HealthRatingKey, HealthColorSet> = {
  green: { solid: "bg-[#22A447] text-white", dot: "bg-[#22A447]" },
  // Amber is the lightest of the four — dark text for contrast, the others get white.
  amber: { solid: "bg-[#F5A623] text-amber-950", dot: "bg-[#F5A623]" },
  "potential-red": { solid: "bg-[#F05A28] text-white", dot: "bg-[#F05A28]" },
  red: { solid: "bg-[#A6192E] text-white", dot: "bg-[#A6192E]" },
};

export const HEALTH_RATING_COLORS_BY_API_LABEL: Record<HealthRatingApiLabel, HealthColorSet> = {
  Green: HEALTH_RATING_COLORS.green,
  Amber: HEALTH_RATING_COLORS.amber,
  "Potential Red": HEALTH_RATING_COLORS["potential-red"],
  Red: HEALTH_RATING_COLORS.red,
};
