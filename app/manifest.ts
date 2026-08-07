import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bibata",
    short_name: "Bibata",
    description: "Apprendre une langue en jouant, une mission à la fois.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1e8",
    theme_color: "#173f36",
  };
}
