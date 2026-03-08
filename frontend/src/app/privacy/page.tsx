import type { Metadata } from "next";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for OpenNoesis covering what information we collect, how we use it, and how we handle data.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy | OpenNoesis",
    description:
      "Privacy Policy for OpenNoesis covering what information we collect, how we use it, and how we handle data.",
    url: "/privacy",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | OpenNoesis",
    description:
      "Privacy Policy for OpenNoesis covering what information we collect, how we use it, and how we handle data.",
  },
};

export default function PrivacyPage() {
  return (
    <NavigationOverlay>
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto max-w-3xl space-y-8">
          <section className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
            <p className="text-muted-foreground">
              OpenNoesis is a debate and discussion platform. This Privacy Policy explains how we
              collect, use, store, and share information when you use the OpenNoesis website, API,
              and real-time features.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">What We Collect</h2>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Account data you provide: email, username, and password.</li>
              <li>Profile data you provide: bio.</li>
              <li>Public debate content: debates, comments, votes, and stances.</li>
              <li>Private discussion data: messages, read states, and discussion metadata.</li>
              <li>
                AI discussion data: messages and related context needed to generate AI replies.
              </li>
              <li>Invite, pairing, and notification metadata needed for platform features.</li>
              <li>Security/session data: framework session and CSRF cookies.</li>
              <li>Infrastructure log data used for operation and security.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Public Visibility of Content</h2>
            <p className="text-muted-foreground">
              Debate posts and comments are public by default. They may be accessible to visitors
              and may be indexed by search engines.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">How We Use Information</h2>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>To run core features (debates, comments, invites, pairing, discussions).</li>
              <li>To generate responses when you use AI discussion features.</li>
              <li>To authenticate users and keep accounts secure.</li>
              <li>To send account and security-related emails.</li>
              <li>To deliver notifications and real-time updates.</li>
              <li>To operate, troubleshoot, and secure the platform.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Cookies</h2>
            <p className="text-muted-foreground">
              We use framework-level functional/security cookies: <code>sessionid</code> for
              authenticated sessions and <code>csrftoken</code> for CSRF protection.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Sharing</h2>
            <p className="text-muted-foreground">
              We do not sell user data. We only share data as needed with infrastructure/service
              providers that run OpenNoesis (including Cloudflare, hosting infrastructure in NYC1,
              AWS SES for email, and OpenAI for AI discussion processing), for legal/safety
              obligations, or during a business transfer.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Retention</h2>
            <p className="text-muted-foreground">
              We keep data for as long as needed to provide and maintain active accounts and
              platform features, protect platform security and integrity, resolve operational
              issues, and meet legal obligations. Retention periods may vary by data type and
              operational need. Logs and backups follow operational rotation practices.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Your Choices and Requests</h2>
            <p className="text-muted-foreground">
              OpenNoesis does not currently provide a full self-serve deletion flow in-product. You
              may contact us to request account deletion or other data-related requests. We review
              requests based on technical, operational, and legal constraints.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Security</h2>
            <p className="text-muted-foreground">
              We use practical safeguards including HTTPS/TLS, authenticated sessions, and CSRF
              protections. No system can guarantee absolute security.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Children</h2>
            <p className="text-muted-foreground">
              OpenNoesis is not intended for children under 13. We do not knowingly collect
              personal information from children under 13.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Cross-Border Processing</h2>
            <p className="text-muted-foreground">
              Depending on where you are located, our infrastructure providers (including
              Cloudflare, hosting providers, AWS SES, and OpenAI when AI discussions are used) may
              process data outside your province, state, or country.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Contact</h2>
            <p className="text-muted-foreground">
              For privacy questions or requests: justin [dot] tovich [at] gmail [dot] com
            </p>
          </section>
        </div>
      </div>
    </NavigationOverlay>
  );
}
