import type { Metadata } from "next";
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED, SITE_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: `The terms that govern use of ${SITE_OPERATOR}.`,
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-foreground-muted">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        Terms &amp; Conditions
      </h1>
      <p className="mb-8 text-xs text-foreground-subtle">
        Last updated: {LEGAL_LAST_UPDATED}
      </p>

      <div className="flex flex-col gap-8">
        <Section title="Acceptance of terms">
          <p>
            By accessing or using {SITE_OPERATOR}, you agree to these Terms
            &amp; Conditions. If you don&apos;t agree, please don&apos;t use
            the site.
          </p>
        </Section>

        <Section title="Description of service">
          <p>
            {SITE_OPERATOR} publishes short, rewritten summaries of video
            game industry news sourced from third-party publishers. We are a
            curation and summarization service, not a original-reporting
            outlet — every card links to the original source.
          </p>
        </Section>

        <Section title="Content & attribution">
          <p>
            Summaries are written in-house based on publicly available
            reporting and are provided for informational purposes only. We
            make no guarantee of completeness, accuracy, or timeliness, and
            summaries may not capture every nuance of the original story —
            always check the linked source for the full details.
          </p>
        </Section>

        <Section title="Intellectual property">
          <p>
            The {SITE_OPERATOR} name, design, and summary text are our own
            work. Article headlines, images, and reporting linked from this
            site remain the property of their respective publishers.
          </p>
        </Section>

        <Section title="User conduct">
          <p>
            If the site allows likes or comments, you agree not to post
            unlawful, abusive, or infringing content. We reserve the right to
            remove content or restrict access at our discretion.
          </p>
        </Section>

        <Section title="Third-party links & advertising">
          <p>
            This site contains links to third-party sites (news sources,
            deal/affiliate links) and may display third-party advertising.
            We aren&apos;t responsible for the content, accuracy, or
            practices of those third parties. Some links may be affiliate
            links — see our{" "}
            <a href="/privacy-policy" className="font-medium text-accent hover:text-accent-hover">
              Privacy Policy
            </a>{" "}
            for details.
          </p>
        </Section>

        <Section title="Content removal / DMCA">
          <p>
            If you&apos;re a rights holder and believe content on this site
            infringes your copyright or misrepresents your reporting, email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-accent hover:text-accent-hover"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            with the affected URL and we&apos;ll review it promptly.
          </p>
        </Section>

        <Section title="Disclaimer of warranties">
          <p>
            The site is provided &quot;as is&quot; without warranties of any
            kind. We don&apos;t guarantee uninterrupted or error-free
            operation.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the fullest extent permitted by law, {SITE_OPERATOR} isn&apos;t
            liable for any indirect, incidental, or consequential damages
            arising from your use of the site.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            We may update these terms from time to time. Continued use of the
            site after a change constitutes acceptance of the updated terms.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These terms are governed by the laws of the jurisdiction in which{" "}
            {SITE_OPERATOR} operates, without regard to conflict-of-law
            principles.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms? Email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-accent hover:text-accent-hover"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
