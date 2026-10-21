import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const VALID = /^vm-vitals-(linux|darwin)-(amd64|arm64)$/;

/**
 * Agent binary download. If RELEASE_BASE_URL is set (GitHub release, Blob,
 * S3...), redirect there. Otherwise serve from web/public/dl/ for local dev.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!VALID.test(file)) return NextResponse.json({ error: "unknown target" }, { status: 404 });
  const base = process.env.RELEASE_BASE_URL;
  if (base) return NextResponse.redirect(`${base.replace(/\/$/, "")}/${file}`, 302);

  const p = path.join(process.cwd(), "public", "dl", file);
  try {
    const st = await stat(p);
    const data = await readFile(p);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(st.size),
        "content-disposition": `attachment; filename="${file}"`,
        "cache-control": "no-cache",
      },
    });
  } catch {
    return NextResponse.json(
      { error: `binary ${file} not built. Run ./agent/build.sh, or set RELEASE_BASE_URL.` },
      { status: 404 },
    );
  }
}
