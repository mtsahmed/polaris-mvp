import type { MetadataRoute } from "next";
import { seo, siteUrl } from "@/config/seo";

// robots.txt: the landing page is open to crawlers, the app behind sign-in is not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...seo.privatePaths] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
