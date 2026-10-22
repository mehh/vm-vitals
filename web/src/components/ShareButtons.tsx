"use client";

import { useEffect, useState } from "react";

/** Copy link, plus the native share sheet where the browser has one. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(!!navigator.share), []);
  return (
    <>
      <button
        className="btn"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
      {canShare && (
        <button className="btn" onClick={() => navigator.share({ title, url }).catch(() => {})}>
          Share…
        </button>
      )}
    </>
  );
}
