import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Badminton Tracker",
    short_name: "Badminton",
    description: "Scores, ratings and stats for our 2v2 badminton sessions.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f2",
    theme_color: "#07382a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
