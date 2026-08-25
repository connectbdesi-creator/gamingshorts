import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GameShorts — Gaming News in 60 Words",
    short_name: "GameShorts",
    description:
      "Video game industry news, reviews, patches, and deals summarized into 60-word cards.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/icon1", sizes: "512x512", type: "image/png" },
    ],
  };
}
