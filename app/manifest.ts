import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bibata",
    short_name: "Bibata",
    description: "Apprendre une langue en jouant, une mission à la fois.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f5f1e8",
    theme_color: "#1d5548",
    categories: ["education", "productivity"],
    lang: "fr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Continuer ma mission", short_name: "Continuer", url: "/", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
