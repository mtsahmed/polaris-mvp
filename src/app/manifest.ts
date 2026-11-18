import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
import { seo } from "@/config/seo";

// Web app manifest: name, colours and icon when Polaris is saved to a phone or desktop.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.fullName,
    short_name: brand.productName,
    description: seo.description,
    start_url: "/profiles",
    display: "standalone",
    background_color: "#0b1026",
    theme_color: "#c4006a",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
