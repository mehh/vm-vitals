/** Names and links used across pages, metadata and OG images. */
export const SITE = {
  name: "VM Vitals",
  tagline: "Is my bot's computer okay?",
  description:
    "A heartbeat for the computer your Grok Bot lives on. Paste one prompt into your bot and get a live dashboard, alerts before the disk fills, and a share card with little blobs that sweat when your box does.",
  repo: "https://github.com/mehh/vm-vitals",
} as const;

export const src = (path: string) => `${SITE.repo}/blob/main/${path}`;
