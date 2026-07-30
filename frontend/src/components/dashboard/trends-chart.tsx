"use client";

import { useState } from "react";

// Series colors validated for CVD separation and normal-vision distance on a
// white surface (dataviz palette check). The light bar is sub-3:1 contrast, so
// every column carries a visible cap label as relief.
const HEALTH_COLOR = "#1c5cab";
const COMPLIANCE_COLOR = "#6da7ec";

// Rolling weekly portfolio averages — sample data until there's a backend.
const WEEKS = [
  { week: "WK 32", health: 58, compliance: 54 },
  { week: "WK 33", health: 52, compliance: 48 },
  { week: "WK 34", health: 60, compliance: 56 },
  { week: "WK 35", health: 70, compliance: 66 },
  { week: "WK 36", health: 65, compliance: 62 },
  { week: "WK 37", health: 84, compliance: 80 },
  { week: "WK 38", health: 92, compliance: 88 },
];

const VIEW_W = 440;
const VIEW_H = 240;
const PAD = { top: 18, right: 10, bottom: 28, left: 34 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;
const BAR_W = 18;

const yFor = (value: number) => PAD.top + PLOT_H * (1 - value / 100);
const slotX = (i: number) => PAD.left + (PLOT_W / WEEKS.length) * (i + 0.5);

// Column with a 4px rounded data-end and a square baseline.
function barPath(cx: number, value: number) {
  const x = cx - BAR_W / 2;
  const y = yFor(value);
  const bottom = PAD.top + PLOT_H;
  const r = 4;
  return `M${x},${bottom} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + BAR_W - r},${y} Q${x + BAR_W},${y} ${x + BAR_W},${y + r} L${x + BAR_W},${bottom} Z`;
}

export function TrendsChart() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">
            Health &amp; Compliance Trend
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Weekly portfolio average
          </p>
        </div>
        <div className="flex items-center gap-5 text-sm text-slate-600">
          <span className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: HEALTH_COLOR }}
            />
            Health Score
          </span>
          <span className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: COMPLIANCE_COLOR }}
            />
            Compliance %
          </span>
        </div>
      </div>

      <div className="relative mt-4">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full"
          role="img"
          aria-label="Weekly portfolio health score and compliance percentage"
          onMouseLeave={() => setHovered(null)}
        >
          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={VIEW_W - PAD.right}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke={tick === 0 ? "#cbd5e1" : "#e2e8f0"}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={yFor(tick) + 3.5}
                textAnchor="end"
                className="fill-slate-400 text-[11px]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {tick}
              </text>
            </g>
          ))}

          {WEEKS.map((d, i) => {
            const cx = slotX(i);
            const active = hovered === i;
            return (
              <g key={d.week}>
                <path
                  d={barPath(cx, d.compliance)}
                  fill={COMPLIANCE_COLOR}
                  opacity={hovered === null || active ? 1 : 0.55}
                />
                {/* Compliance value on the cap — relief for the light fill */}
                <text
                  x={cx}
                  y={yFor(d.compliance) - 6}
                  textAnchor="middle"
                  className="fill-slate-500 text-[11px]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {d.compliance}
                </text>
                <circle
                  cx={cx}
                  cy={yFor(d.health)}
                  r={active ? 6 : 5}
                  fill={HEALTH_COLOR}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <text
                  x={cx}
                  y={VIEW_H - 8}
                  textAnchor="middle"
                  className="fill-slate-500 text-[11px] font-medium"
                >
                  {d.week}
                </text>
                <rect
                  x={cx - PLOT_W / WEEKS.length / 2}
                  y={PAD.top}
                  width={PLOT_W / WEEKS.length}
                  height={PLOT_H}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                />
              </g>
            );
          })}
        </svg>

        {hovered !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
            style={{ left: `${(slotX(hovered) / VIEW_W) * 100}%` }}
          >
            <div className="font-bold text-slate-900">
              {WEEKS[hovered].week}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-slate-600">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: HEALTH_COLOR }}
              />
              Health Score: {WEEKS[hovered].health}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-slate-600">
              <span
                className="size-2 rounded-sm"
                style={{ backgroundColor: COMPLIANCE_COLOR }}
              />
              Compliance: {WEEKS[hovered].compliance}%
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
