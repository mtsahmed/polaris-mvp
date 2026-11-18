import type { MetadataRoute } from "next";
import { siteUrl } from "@/config/seo";

// sitemap.xml: the public pages. Add new public pages (pricing, blog posts) here.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
  ];
}
