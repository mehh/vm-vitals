import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/format";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/m/", "/api/", "/auth/"] },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
