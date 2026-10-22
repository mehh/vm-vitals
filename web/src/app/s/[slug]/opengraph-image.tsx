import { ImageResponse } from "next/og";
import { OG_SIZE, shareCard } from "@/lib/og";
import { shareCardData } from "@/lib/shareCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Live health card for a machine running an AI agent";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await shareCardData(slug);
  if (!d) {
    return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#000", color: "#8a8a8a", alignItems: "center", justifyContent: "center", fontSize: 40 }}>no pulse here</div>, OG_SIZE);
  }
  return shareCard(d);
}
