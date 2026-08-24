import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Best-effort fast path called by the ingestion workflow right after it
 * pushes new data. New card slugs still need the full rebuild that push
 * triggers (generateStaticParams only runs at build time) — this just
 * refreshes already-built pages immediately instead of waiting out the
 * 2-hour ISR window, for the case where the underlying content of an
 * existing card changed.
 */
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ revalidated: false, message: "Invalid secret" }, { status: 401 });
  }

  revalidatePath("/", "layout");

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
