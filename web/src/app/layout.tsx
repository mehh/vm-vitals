import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { appUrl } from "@/lib/format";
import { SITE } from "@/lib/site";

const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: `${SITE.name} · ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ["grok bot", "ai agent monitoring", "vm monitoring", "claude code", "codex", "uptime", "build in public"],
  openGraph: { siteName: SITE.name, type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable}>
      <body className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-black/80 backdrop-blur">
          <div className="wrap flex h-14 items-center justify-between">
            <Link href="/" className="text-sm font-bold tracking-tight">
              vm<span className="text-muted">-</span>vitals<span className="cursor" aria-hidden />
            </Link>
            <nav className="flex items-center gap-5 text-[13px] text-fg-2">
              <Link href="/install" className="hover:text-fg">
                install
              </Link>
              <Link href="/privacy" className="hidden hover:text-fg sm:inline">
                what it sends
              </Link>
              <a href={SITE.repo} className="hover:text-fg" target="_blank" rel="noreferrer">
                source ↗
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-24 border-t border-line">
          <div className="wrap flex flex-col gap-6 py-10 text-xs text-muted md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <div className="text-fg">vm-vitals · a heartbeat for your bot&apos;s computer</div>
              <div>
                Open source, MIT.{" "}
                <a href={SITE.repo} className="link text-fg-2" target="_blank" rel="noreferrer">
                  Read every line on GitHub
                </a>
                . Numbers only, never secrets.
              </div>
            </div>
            <nav className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/install" className="hover:text-fg">
                install
              </Link>
              <Link href="/privacy" className="hover:text-fg">
                what it sends
              </Link>
              <a href={`${SITE.repo}/blob/main/SECURITY.md`} className="hover:text-fg" target="_blank" rel="noreferrer">
                security
              </a>
              <a href={`${SITE.repo}/issues/new/choose`} className="hover:text-fg" target="_blank" rel="noreferrer">
                report a bug
              </a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
