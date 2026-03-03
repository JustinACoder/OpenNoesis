import type { Metadata } from "next";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn what OpenNoesis is about, why we built it, and the principles that guide our debate platform.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Us | OpenNoesis",
    description:
      "Learn what OpenNoesis is about, why we built it, and the principles that guide our debate platform.",
    url: "/about",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Us | OpenNoesis",
    description:
      "Learn what OpenNoesis is about, why we built it, and the principles that guide our debate platform.",
  },
};

const principles = [
  "No subject is unacceptable to debate.",
  "A debate can be badly framed, offensive, or weakly argued, but the conceptual question itself is never forbidden.",
  "The platform is built to support structured, direct, and honest exchange of opinions.",
];

export default function AboutPage() {
  return (
    <NavigationOverlay>
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="mx-auto max-w-3xl space-y-8">
          <section className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">About OpenNoesis</h1>
            <p className="text-muted-foreground">
              OpenNoesis is a structured platform built to make it easier for people to connect and
              debate any subject, including taboo and controversial topics.
            </p>
            <p className="text-muted-foreground">
              In simple terms, noesis refers to intellectual understanding, so OpenNoesis is about
              open, direct thinking through debate.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Mission</h2>
            <p className="text-muted-foreground">
              The goal is simple: help people find others who want to debate and share opinions through
              a clear, structured format designed for real discussion.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Position</h2>
            <div className="space-y-3 text-muted-foreground">
              {principles.map((principle) => (
                <p key={principle}>
                  {principle}
                </p>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Creator</h2>
            <p className="text-muted-foreground">
              OpenNoesis was created by Justin Renaud.{" "}
              <a
                href="https://github.com/JustinACoder"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                GitHub
              </a>{" "}
              and{" "}
              <a
                href="https://www.linkedin.com/in/just-renaud/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                LinkedIn
              </a>
              .
            </p>
            <p className="text-muted-foreground">
              Repository:{" "}
              <a
                href="https://github.com/JustinACoder/ProjectOpenDebate"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                github.com/JustinACoder/ProjectOpenDebate
              </a>.
            </p>
          </section>
        </div>
      </div>
    </NavigationOverlay>
  );
}
