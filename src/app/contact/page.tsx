import type { Metadata } from "next";
import { CONTACT_EMAIL, SITE_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Get in touch with ${SITE_OPERATOR} — corrections, takedown requests, partnerships, and general questions.`,
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Contact Us</h1>

      <div className="flex flex-col gap-5 text-sm leading-relaxed text-foreground-muted">
        <p>
          For corrections, content removal / takedown requests, partnership
          or advertising inquiries, or anything else, email us at:
        </p>

        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-block w-fit rounded-chip border border-border bg-surface px-4 py-2 text-base font-semibold text-accent hover:border-accent/50 hover:text-accent-hover"
        >
          {CONTACT_EMAIL}
        </a>

        <p>
          If you&apos;re a publisher and believe one of our summaries
          misrepresents your reporting, or you&apos;d like a card removed,
          include the card&apos;s URL and we&apos;ll respond as quickly as we
          can.
        </p>

        <p>We aim to reply within a few business days.</p>
      </div>
    </div>
  );
}
