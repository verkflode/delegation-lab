"use client";

import type { DecompositionProfile } from "../lib/types";

/**
 * Five-axis radar chart visualizing the Authority Decomposition profile
 * for a decision type. The axes correspond to VAOM v3.0 §4.2:
 *   Reversibility · Consequence Scope · Regulatory Exposure
 *   Confidence Measurability · Accountability Clarity
 *
 * Each dimension is normalized to a 1..4 score where higher = "more
 * delegation-friendly". The shape of the polygon shows at a glance
 * whether the decision is a strong delegation candidate or whether one
 * dimension is dragging the whole profile down.
 */

// Short labels — long names like "Accountability" / "Confidence" don't fit
// inside the SVG without clipping, so we use abbreviations the player can
// still read at a glance.
const DIMENSIONS = [
  { key: "reversibility", label: "REVERSE" },
  { key: "consequenceScope", label: "SCOPE" },
  { key: "regulatoryExposure", label: "REGUL." },
  { key: "confidenceMeasurability", label: "CONFID." },
  { key: "accountabilityClarity", label: "OWNER" },
] as const;

const SCORES = {
  // Reversibility — higher = easier to undo
  fully_reversible: 4,
  reversible_friction: 3,
  partially_reversible: 2,
  irreversible: 1,
  // Consequence scope — lower scope = better delegation candidate
  internal_operational: 4,
  internal_financial: 3,
  external_relational: 2,
  external_regulatory: 1,
  // Regulatory exposure — less regulated = better
  none: 4,
  general_context: 3,
  regulated: 2,
  prohibited: 1,
  // Confidence measurability
  quantifiable: 4,
  partially_quantifiable: 2.5,
  judgment_dependent: 1,
  // Accountability clarity
  clear_owner: 4,
  shared_defined: 3,
  ambiguous: 2,
  no_owner: 1,
} as const;

type Props = {
  profile: DecompositionProfile;
  size?: number;
  showLabels?: boolean;
};

export function DecompositionRadar({ profile, size = 200, showLabels = true }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  // Tighter polygon radius leaves more room for labels around the edge.
  const radius = size * 0.32;

  const values = DIMENSIONS.map((d) => {
    const v = profile[d.key] as keyof typeof SCORES;
    return (SCORES[v] ?? 2) / 4; // normalized 0..1
  });

  // Compute polygon points
  const points = values
    .map((v, i) => {
      const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
      const r = radius * v;
      return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
    })
    .join(" ");

  // Background grid (4 concentric rings)
  const rings = [0.25, 0.5, 0.75, 1].map((scale) => {
    const ringPoints = DIMENSIONS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
      const r = radius * scale;
      return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
    }).join(" ");
    return ringPoints;
  });

  // Average value as a heuristic for delegation fitness color
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const stroke =
    avg >= 0.75 ? "rgb(95,173,86)" : avg >= 0.5 ? "rgb(232,185,49)" : "rgb(214,40,40)";
  const fill =
    avg >= 0.75
      ? "rgba(95,173,86,0.18)"
      : avg >= 0.5
        ? "rgba(232,185,49,0.18)"
        : "rgba(214,40,40,0.16)";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Decomposition radar">
      {/* Grid rings */}
      {rings.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}
      {/* Axes */}
      {DIMENSIONS.map((_, i) => {
        const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        );
      })}
      {/* Profile shape */}
      <polygon points={points} fill={fill} stroke={stroke} strokeWidth={1.5} />
      {/* Vertex dots */}
      {values.map((v, i) => {
        const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
        const r = radius * v;
        return (
          <circle
            key={i}
            cx={cx + Math.cos(angle) * r}
            cy={cy + Math.sin(angle) * r}
            r={2}
            fill={stroke}
          />
        );
      })}
      {/* Labels */}
      {showLabels &&
        DIMENSIONS.map((d, i) => {
          const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
          const labelR = radius + 14;
          const x = cx + Math.cos(angle) * labelR;
          const y = cy + Math.sin(angle) * labelR;
          const anchor =
            Math.abs(Math.cos(angle)) < 0.2
              ? "middle"
              : Math.cos(angle) > 0
                ? "start"
                : "end";
          return (
            <text
              key={d.key}
              x={x}
              y={y}
              fill="rgba(139,164,184,0.85)"
              fontSize={8}
              fontFamily="var(--font-space-mono)"
              textAnchor={anchor}
              dominantBaseline="middle"
              style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
            >
              {d.label}
            </text>
          );
        })}
    </svg>
  );
}
