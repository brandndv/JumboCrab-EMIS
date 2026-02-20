import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jumbo Crab EMIS",
    short_name: "EMIS",
    description: "Employee Management and Information System",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0f14",
    theme_color: "#f97316",
    icons: [
      {
        src: "/pwa-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
