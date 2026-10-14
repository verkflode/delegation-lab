/**
 * Verkflöde brand mark — the official verkflode.svg, in its light-background colours (ink, as on the VAOM v5 page); verkflode-on-dark.svg is the original for dark backgrounds.
 * The SVG contains the full leaf/circuit-board hybrid + "Verk" wordmark + "flöde"
 * subscript lockup exactly as designed.
 */

type Props = {
  /** Height in pixels. Width scales with the SVG's native aspect ratio. */
  height?: number;
  className?: string;
};

export function VerkflodeLogo({ height = 56, className }: Props) {
  return (
    <img
      src="/verkflode.svg"
      alt="Verkflöde"
      height={height}
      className={className}
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
