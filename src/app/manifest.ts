import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HeroHabits: Super Squad",
    short_name: "HeroHabits",
    description: "Superhero chore missions for kids and parents.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1022",
    theme_color: "#0059ff",
    orientation: "any",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
