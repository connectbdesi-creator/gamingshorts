import type { Metadata } from "next";
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED, SITE_OPERATOR } from "@/lib/legal";
import { pageAlternates } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_OPERATOR} collects, uses, and protects your information.`,
  alternates: pageAlternates("/privacy-policy"),
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

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-foreground">Privacy Policy</h1>
      <p className="mb-8 text-xs text-foreground-subtle">
        Last updated: {LEGAL_LAST_UPDATED}
      </p>

      <div className="flex flex-col gap-8">
        <Section title="Overview">
          <p>
            This policy explains what information {SITE_OPERATOR}
            (&quot;we&quot;, &quot;us&quot;) collects when you use this site,
            how it&apos;s used, and the choices you have. By using the site,
            you agree to the practices described here.
          </p>
        </Section>

        <Section title="Information we collect">
          <p>
            <strong className="text-foreground">Usage data.</strong> Standard
            technical data such as pages visited, referring site, device/
            browser type, and approximate location (from IP address), typically
            collected via analytics tooling.
          </p>
          <p>
            <strong className="text-foreground">Local storage &amp; cookies.</strong>{" "}
            We use your browser&apos;s local storage to remember preferences
            such as light/dark theme. If you like a card or follow a game,
            that action is tied to an anonymous device identifier rather than
            an account.
          </p>
          <p>
            <strong className="text-foreground">Push notifications.</strong>{" "}
            If you opt in to notifications for a followed game, your
            browser&apos;s push subscription endpoint is stored so we can
            deliver that notification. You can revoke this at any time from
            your browser settings.
          </p>
          <p>
            <strong className="text-foreground">Comments.</strong> If the site
            has commenting enabled, comments are handled by a third-party
            embed and governed by that provider&apos;s own privacy policy in
            addition to this one.
          </p>
        </Section>

        <Section title="Cookies & advertising">
          <p>
            We may work with third-party advertising partners, including
            Google. Google and its partners may use cookies (such as the
            DoubleClick DART cookie) to serve ads based on your visits to
            this site and other sites on the internet. You can opt out of
            personalized advertising by visiting Google&apos;s{" "}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent hover:text-accent-hover"
            >
              Ads Settings
            </a>
            .
          </p>
        </Section>

        <Section title="Third-party services">
          <p>
            We use third-party services to run the site, including hosting
            and edge infrastructure, a database provider for likes/follows,
            a game-metadata API for game info panels, and (optionally)
            analytics and advertising providers. These services may process
            data on our behalf under their own privacy policies.
          </p>
        </Section>

        <Section title="Affiliate links">
          <p>
            Some cards, particularly in the Deals &amp; Sales category, may
            contain affiliate links (e.g. to Steam, Epic, Instant Gaming,
            Eneba, or Amazon). If you make a purchase through one of these
            links, we may earn a commission at no extra cost to you.
          </p>
        </Section>

        <Section title="Children's privacy">
          <p>
            This site is not directed at children under 13, and we do not
            knowingly collect personal information from children under 13.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-1 pl-5">
            <li>Clear local storage/cookies via your browser settings to reset preferences and follows.</li>
            <li>Revoke push notification permission from your browser at any time.</li>
            <li>Opt out of personalized ads via Google Ads Settings (linked above).</li>
          </ul>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy from time to time. The &quot;Last
            updated&quot; date above reflects the most recent revision.
            Continued use of the site after a change constitutes acceptance
            of the updated policy.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy? Email{" "}
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
