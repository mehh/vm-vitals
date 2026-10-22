import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // OG cards read Geist Mono from disk at request time.
  outputFileTracingIncludes: {
    "/s/[slug]/opengraph-image": ["./assets/fonts/*.ttf"],
    "/s/[slug]/twitter-image": ["./assets/fonts/*.ttf"],
    "/og/demo": ["./assets/fonts/*.ttf"],
    "/opengraph-image": ["./assets/fonts/*.ttf"],
    "/twitter-image": ["./assets/fonts/*.ttf"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
