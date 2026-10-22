import { appUrl } from "@/lib/format";
import { OG_SIZE, homeCard } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "VM Vitals: is my bot's computer okay? Grok Bot and its blob friends";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return homeCard(appUrl());
}
