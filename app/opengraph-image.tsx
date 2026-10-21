import { ImageResponse } from "next/og";

// The link preview for lab.vaom.ai. Shared links travel without context, so the card names the framework
// in full, next to its acronym, in the VAOM 5.0 light identity.
export const alt = "Delegation Lab: the Verkflöde Agent Operating Model (VAOM) by play";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F7F5F0", padding: "72px 80px", color: "#14140F" }}>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: "#2D6A4F", textTransform: "uppercase" }}>Delegation Lab · lab.vaom.ai</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, lineHeight: 1.05, color: "#0A382B" }}>A flight simulator</div>
          <div style={{ fontSize: 84, lineHeight: 1.05, color: "#0A382B" }}>for AI governance.</div>
          <div style={{ fontSize: 34, marginTop: 28, color: "#4A4A40" }}>Write the matrix. The VAOM Guardian decides every call.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "2px solid #E4DFD3", paddingTop: 24 }}>
          <div style={{ display: "flex", fontSize: 30, color: "#2C2C24" }}>Verkflöde Agent Operating Model (VAOM) 5.0</div>
          <div style={{ display: "flex", fontSize: 24, color: "#8A6116" }}>Open framework · CC BY 4.0</div>
        </div>
      </div>
    ),
    size,
  );
}
