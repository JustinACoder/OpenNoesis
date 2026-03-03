import type { Metadata } from "next";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for OpenNoesis covering account use, user content, moderation, and platform limits.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Service | OpenNoesis",
    description:
      "Terms of Service for OpenNoesis covering account use, user content, moderation, and platform limits.",
    url: "/terms",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service | OpenNoesis",
    description:
      "Terms of Service for OpenNoesis covering account use, user content, moderation, and platform limits.",
  },
};

export default function TermsPage() {
  return (
    <NavigationOverlay>
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto max-w-3xl space-y-8">
          <section className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Terms of Service</h1>
            <p className="text-muted-foreground">
              These Terms of Service govern your use of OpenNoesis, a debate and discussion platform.
              By creating an account, accessing, or using OpenNoesis, you agree to these Terms. If
              you do not agree, do not use the platform.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Eligibility</h2>
            <p className="text-muted-foreground">
              You must be at least 13 years old to use OpenNoesis. If you are under the age of
              majority where you live, you must have permission from a parent or legal guardian to
              use OpenNoesis. By using OpenNoesis, you confirm that you meet these requirements and
              can form a binding agreement.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">User Accounts</h2>
            <p className="text-muted-foreground">
              You are responsible for your account and activity under it, including keeping login
              credentials secure. You agree to provide accurate account information and keep it
              reasonably up to date.
            </p>
            <p className="text-muted-foreground">
              You may request account deletion or other account-related help by contacting: justin
              [dot] tovich [at] gmail [dot] com
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Platform Features</h2>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Public debates</li>
              <li>Public comments</li>
              <li>Voting and stance participation</li>
              <li>Private 1-on-1 discussions</li>
              <li>Pairing and invite-based matching</li>
              <li>Notifications</li>
            </ul>
            <p className="text-muted-foreground">
              Features may change over time. We may add, remove, pause, or modify features without
              guaranteeing advance notice.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">User Content: Ownership and License</h2>
            <p className="text-muted-foreground">
              You retain ownership of content you submit to OpenNoesis (such as debate posts,
              comments, and messages).
            </p>
            <p className="text-muted-foreground">
              By posting or submitting content, you grant OpenNoesis a non-exclusive, worldwide,
              royalty-free license to host, store, reproduce, display, distribute, and modify that
              content as needed to operate, provide, improve, and maintain the platform and its
              features.
            </p>
            <p className="text-muted-foreground">
              This license lasts for as long as the content remains on OpenNoesis, and for a
              reasonable period needed for backups, legal compliance, and technical operations.
            </p>
            <p className="text-muted-foreground">
              You are responsible for ensuring you have the rights needed to post your content.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Public Content and Visibility</h2>
            <p className="text-muted-foreground">
              Debates and comments are public by default. They may be visible to anyone, including
              people without an account.
            </p>
            <p className="text-muted-foreground">
              Public content may be indexed by search engines and may remain accessible through
              third-party indexing or caching systems outside our direct control.
            </p>
            <p className="text-muted-foreground">
              Private discussions are intended for participants, but OpenNoesis may access private
              discussion content when reasonably necessary for security, abuse handling, or platform
              operations.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Prohibited Conduct</h2>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Illegal activity</li>
              <li>Harassment, threats, or targeted abuse</li>
              <li>Impersonation or deceptive identity use</li>
              <li>Spam or abusive automated activity</li>
              <li>
                Security abuse (for example: probing, attacking, disrupting, or attempting
                unauthorized access)
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Moderation and Enforcement</h2>
            <p className="text-muted-foreground">
              OpenNoesis may remove content, restrict features, suspend accounts, or terminate
              accounts if needed, including for Terms violations, abuse, security risks, or legal
              compliance.
            </p>
            <p className="text-muted-foreground">
              These actions may be taken with or without notice.
            </p>
            <p className="text-muted-foreground">
              OpenNoesis does not guarantee active pre-screening, editorial review, or continuous
              moderation of user content.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Account Suspension or Termination</h2>
            <p className="text-muted-foreground">
              We may suspend or terminate access based on conduct described in these Terms,
              including abuse and security concerns.
            </p>
            <p className="text-muted-foreground">
              You may stop using OpenNoesis at any time. You may also request account deletion by
              contacting: justin [dot] tovich [at] gmail [dot] com
            </p>
            <p className="text-muted-foreground">
              If your account is deleted, public debate/comment content may remain on the platform,
              and may be de-identified where appropriate.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Platform Availability and Changes</h2>
            <p className="text-muted-foreground">
              OpenNoesis is provided on an evolving basis. We do not guarantee uninterrupted
              availability, uptime, or error-free operation.
            </p>
            <p className="text-muted-foreground">
              We may perform maintenance, update systems, or make product changes that affect
              availability or behavior.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Disclaimers</h2>
            <p className="text-muted-foreground">
              OpenNoesis is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
            </p>
            <p className="text-muted-foreground">
              User content reflects user views, not OpenNoesis endorsements. We do not guarantee the
              accuracy, completeness, or reliability of user-submitted content.
            </p>
            <p className="text-muted-foreground">
              Content on OpenNoesis is for discussion purposes only and is not legal, medical,
              financial, or other professional advice.
            </p>
            <p className="text-muted-foreground">
              OpenNoesis is not responsible for the conduct of users.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Limitation of Liability</h2>
            <p className="text-muted-foreground">
              To the fullest extent permitted by applicable law, OpenNoesis is not liable for
              indirect, incidental, special, consequential, or punitive damages arising from or
              related to your use of the platform.
            </p>
            <p className="text-muted-foreground">
              Where liability cannot be excluded, it is limited to a reasonable and proportionate
              amount in light of the nature of the service and the specific claim.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms are governed by the laws of Quebec, Canada.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Contact</h2>
            <p className="text-muted-foreground">
              For Terms questions, account requests, or data-related requests: justin [dot] tovich
              [at] gmail [dot] com
            </p>
          </section>
        </div>
      </div>
    </NavigationOverlay>
  );
}
