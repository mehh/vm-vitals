import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/format";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  return ["", "/install", "/privacy"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority: p ? 0.6 : 1 }));
}
