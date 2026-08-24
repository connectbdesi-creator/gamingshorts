import type { Metadata } from "next";

// Phase 5+ derives this from ingested release-date data; for now this is
// just the routed page shell described in the Phase 1 folder structure.
export const revalidate = 7200;

export const metadata: Metadata = {
  title: "Release Calendar",
  description:
    "Upcoming video game releases for the next 2-4 weeks, across PC, PlayStation, Xbox, Switch, mobile, and VR.",
};

export default function ReleaseCalendarPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-xl font-bold text-foreground">Release Calendar</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Upcoming launches will appear here once the ingestion pipeline is
        wired up.
      </p>
    </div>
  );
}
