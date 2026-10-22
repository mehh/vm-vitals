import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { appUrl } from "@/lib/format";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "VM Vitals", template: "%s · VM Vitals" },
  description: "A heartbeat for the computer your Grok Bot lives on. Health score, mood, live gauges, alerts, and a share card for X.",
  openGraph: { siteName: "VM Vitals", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-good pulse" aria-hidden />
              VM Vitals
            </Link>
            <nav className="flex items-center gap-4 text-sm text-secondary">
              <Link href="/#install" className="hover:text-primary">
                Hook up a bot
              </Link>
              <Link href="/privacy" className="hover:text-primary">
                What gets sent
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-muted">
          Free and open. Numbers only, never secrets. Made for people whose bots work while they sleep.
        </footer>
      </body>
    </html>
  );
}
