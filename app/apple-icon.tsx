import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Letters rather than the shuttle emoji: ImageResponse ships no emoji font, so
// the glyph is not guaranteed to render on the server.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07382a",
          color: "white",
          fontSize: 88,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        BT
      </div>
    ),
    { ...size },
  );
}
