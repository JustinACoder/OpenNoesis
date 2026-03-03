import type { Metadata } from "next";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description:
    "Community Guidelines for OpenNoesis defining expected behavior and moderation standards for debate.",
  alternates: {
    canonical: "/community-guidelines",
  },
  openGraph: {
    title: "Community Guidelines | OpenNoesis",
    description:
      "Community Guidelines for OpenNoesis defining expected behavior and moderation standards for debate.",
    url: "/community-guidelines",
  },
  twitter: {
    card: "summary_large_image",
    title: "Community Guidelines | OpenNoesis",
    description:
      "Community Guidelines for OpenNoesis defining expected behavior and moderation standards for debate.",
  },
};

export default function CommunityGuidelinesPage() {
  return (
    <NavigationOverlay>
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto max-w-3xl space-y-8">
          <section className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Community Guidelines</h1>
            <p className="text-muted-foreground">
              OpenNoesis exists to make serious disagreement possible without turning discussion
              into hostility. These guidelines define how to debate here: challenge ideas hard,
              treat people like people, and argue in good faith.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">What We Expect</h2>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Debate the point, not the person.</li>
              <li>Argue in good faith and represent opposing views fairly.</li>
              <li>Be intellectually honest and avoid misleading tactics.</li>
              <li>Keep discussions constructive and engage with substance.</li>
              <li>Accept disagreement without turning it into hostility.</li>
              <li>Use voting based on quality and relevance, not personal alliances.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">What Is Not Allowed</h2>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Harassment, threats, intimidation, or targeted abuse.</li>
              <li>Hate speech or dehumanizing content.</li>
              <li>Doxxing or sharing private personal information without consent.</li>
              <li>Spam, fake engagement, vote manipulation, or coordinated inauthentic activity.</li>
              <li>Impersonation of people, organizations, or platform representatives.</li>
              <li>Security abuse, including probing, attacking, or bypass attempts.</li>
              <li>Bad-faith disruption intended to derail discussion.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Public and Private Spaces</h2>
            <p className="text-muted-foreground">
              Public debates and comments are visible to others by default.
            </p>
            <p className="text-muted-foreground">
              Private 1-on-1 discussions are still subject to moderation when abuse, threats,
              harassment, or security issues arise.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Moderation Approach</h2>
            <p className="text-muted-foreground">
              OpenNoesis does not pre-screen all posts, comments, or messages. Moderation aims to
              protect constructive debate and platform safety.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Content removal</li>
              <li>Feature restrictions</li>
              <li>Account suspension</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Final Note</h2>
            <p className="text-muted-foreground">
              OpenNoesis supports debate on difficult, controversial, and taboo topics. You do not
              need to agree with others, but you do need to argue clearly, honestly, and with
              respect for the people you disagree with.
            </p>
          </section>
        </div>
      </div>
    </NavigationOverlay>
  );
}
