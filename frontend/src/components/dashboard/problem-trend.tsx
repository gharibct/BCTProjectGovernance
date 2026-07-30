"use client";

import { useState } from "react";

// Status colors from the validated set (see region-breakdown.tsx). Both lines
// carry direct end labels so identity never rests on color alone.
const RED = "#b91c1c";
const POTENTIAL = "#f97316";

// Weekly count of problem projects — sample data until there's a backend.
const WEEKS = [
  { week: "WK 32", red: 2, potentialRed: 5 },
  { week: "WK 33", red: 3, potentialRed: 4 },
  { week: "WK 34", red: 3, potentialRed: 5 },
  { week: "WK 35", red: 4, potentialRed: 4 },
  { week: "WK 36", red: 3, potentialRed: 4 },
  { week: "WK 37", red: 4, potentialRed: 4 },
  { week: "WK 38", red: 4, potentialRed: 3 },
];

const VIEW_W = 440;
const VIEW_H = 240;
const PAD = { top: 16, right: 76, bottom: 28, left: 28 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;
const Y_MAX = 6;

const yFor = (value: number) => PAD.top + PLOT_H * (1 - value / Y_MAX);
const xFor = (i: number) => PAD.left + (PLOT_W / (WEEKS.length - 1)) * i;

function linePoints(key: "red" | "potentialRed") {
  return WEEKS.map((d, i) => `${xFor(i)},${yFor(d[key])}`).join(" ");
}

export function ProblemTrend() {
  const [hovered, setHovered] = useState<number | null>(null);
  const last = WEEKS.length - 1;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">Problem Projects Trend</h2>
      <p className="mt-0.5 text-sm text-slate-500">
        Red and potential red count by week
      </p>

      <div className="relative mt-4">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full"
          role="img"
          aria-label="Weekly count of red and potential red projects"
          onMouseLeave={() => setHovered(null)}
        >
          {[0, 2, 4, 6].map((tick) => (
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

          <polyline
            points={linePoints("potentialRed")}
            fill="none"
            stroke={POTENTIAL}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            points={linePoints("red")}
            fill="none"
            stroke={RED}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {WEEKS.map((d, i) => {
            const active = hovered === i;
            return (
              <g key={d.week}>
                <circle
                  cx={xFor(i)}
                  cy={yFor(d.potentialRed)}
                  r={active ? 5.5 : 4.5}
                  fill={POTENTIAL}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                <circle
                  cx={xFor(i)}
                  cy={yFor(d.red)}
                  r={active ? 5.5 : 4.5}
                  fill={RED}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
                {(i === 0 || i === last || i === 3) && (
                  <text
                    x={xFor(i)}
                    y={VIEW_H - 8}
                    textAnchor="middle"
                    className="fill-slate-500 text-[11px] font-medium"
                  >
                    {d.week}
                  </text>
                )}
                <rect
                  x={xFor(i) - PLOT_W / (WEEKS.length - 1) / 2}
                  y={PAD.top}
                  width={PLOT_W / (WEEKS.length - 1)}
                  height={PLOT_H}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                />
              </g>
            );
          })}

          {/* Direct end labels — identity without relying on color */}
          <text
            x={xFor(last) + 10}
            y={yFor(WEEKS[last].red) + 4}
            className="fill-slate-600 text-[11px] font-semibold"
          >
            Red
          </text>
          <text
            x={xFor(last) + 10}
            y={yFor(WEEKS[last].potentialRed) + 4}
            className="fill-slate-600 text-[11px] font-semibold"
          >
            Potential
          </text>
        </svg>

        {hovered !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
            style={{ left: `${(xFor(hovered) / VIEW_W) * 100}%` }}
          >
            <div className="font-bold text-slate-900">
              {WEEKS[hovered].week}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-slate-600">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: RED }}
              />
              Red: {WEEKS[hovered].red}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-slate-600">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: POTENTIAL }}
              />
              Potential red: {WEEKS[hovered].potentialRed}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
