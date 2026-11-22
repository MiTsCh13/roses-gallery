import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

// Farben wie im Website-Theme (Rosé/Creme), als feste Werte für Satori.
const CREAM = "#fbf7f4";
const ROSE = "#a8304d";
const INK = "#3b2a2f";

/** Teilen-Bild im Website-Stil: Marke oben, großer Titel, Unterzeile. */
export function brandImage({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 88px",
        background: `linear-gradient(180deg, #f6e3e7 0%, ${CREAM} 70%)`,
        color: INK,
      }}
    >
      <div style={{ fontSize: 36, color: ROSE, fontWeight: 700 }}>
        Roses Gallery
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            fontSize: title.length > 60 ? 56 : 72,
            fontWeight: 700,
            lineHeight: 1.1,
            color: ROSE,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 32, lineHeight: 1.35 }}>{subtitle}</div>
        ) : null}
      </div>
      <div style={{ fontSize: 26, color: INK, opacity: 0.7 }}>
        roses-gallery.app
      </div>
    </div>,
    OG_SIZE,
  );
}
