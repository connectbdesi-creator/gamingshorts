import { type NextRequest, NextResponse } from "next/server";

/**
 * Reliable external trigger for the ingestion workflow, bypassing GitHub
 * Actions' own `schedule` event entirely — confirmed via the public
 * Actions API to go completely silent for a given workflow for 11+ hours
 * at a time (not just delayed; zero runs of any kind in that window),
 * which no workflow-file change can fix since the problem is upstream of
 * the file. This endpoint just calls GitHub's REST API to fire a
 * workflow_dispatch; ingest.yml's own "Check if a run is due" step still
 * does the actual ~2-hour gating (see respect_cadence below) — this is
 * only responsible for making sure THAT step gets a chance to run at all,
 * regularly, from an infra with an actual reliability guarantee.
 *
 * Call this on a schedule (every 15-20 min, same cadence the old
 * `schedule` trigger used) from any external, genuinely reliable cron —
 * Vercel Cron Jobs only run once/day on the Hobby plan (too coarse for
 * this), so a free service like cron-job.org is the default recommendation
 * here, not a paid upgrade.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_DISPATCH_SECRET || secret !== process.env.CRON_DISPATCH_SECRET) {
    return NextResponse.json({ dispatched: false, message: "Invalid secret" }, { status: 401 });
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_DISPATCH_REPO;
  if (!token || !repo) {
    return NextResponse.json(
      { dispatched: false, message: "GITHUB_DISPATCH_TOKEN or GITHUB_DISPATCH_REPO not configured" },
      { status: 500 }
    );
  }

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/ingest.yml/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      // respect_cadence=true tells ingest.yml's due-check step to apply
      // the same elapsed-time gate a `schedule` event would — a manual
      // "Run workflow" click in the GitHub UI leaves this input at its
      // default (false) and always runs immediately, same as before.
      body: JSON.stringify({ ref: "main", inputs: { respect_cadence: "true" } }),
    });
  } catch (err) {
    return NextResponse.json({ dispatched: false, message: (err as Error).message }, { status: 502 });
  }

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json(
      { dispatched: false, status: res.status, body: body.slice(0, 500) },
      { status: 502 }
    );
  }

  return NextResponse.json({ dispatched: true, now: new Date().toISOString() });
}
