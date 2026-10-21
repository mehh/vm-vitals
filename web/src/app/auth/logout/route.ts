import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { appUrl } from "@/lib/format";

export const runtime = "nodejs";

export async function POST() {
  await clearSession();
  return NextResponse.redirect(appUrl() + "/", { status: 303 });
}
