import Link from "next/link";
import { SiteLogo } from "@/components/SiteLogo";
import { getDiscordInviteUrl } from "@/lib/social";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  const discordInviteUrl = getDiscordInviteUrl();
  const footerLinks = [
    { label: "About", href: "/about" },
    { label: "Privacy", href: "/privacy" },
    { label: "Community Guidelines", href: "/community-guidelines" },
    { label: "Terms", href: "/terms" },
  ];

  return (
    <footer className="mt-12 bg-[color-mix(in_oklab,var(--background)_90%,black)] backdrop-blur-sm">
      <Separator />
      {/* Brand */}
      <div className="container mx-auto px-4 flex flex-wrap items-baseline gap-x-4 py-6">
        <SiteLogo size="md" />
        <p className="text-sm text-muted-foreground">
          Expanding minds through thoughtful debate
        </p>
      </div>

      <Separator />
      <div className="py-4">
        <nav className="container mx-auto px-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {footerLinks.map((link) => (
            <Link key={link.label} href={link.href} className="hover:text-primary">
              {link.label}
            </Link>
          ))}
          <a
            href={discordInviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary"
          >
            Discord
          </a>
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="cursor-pointer hover:text-primary"
              >
                Contact
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Contact</DialogTitle>
                <DialogDescription className="space-y-3">
                  <span className="block">
                    Happy you want to connect. My name is Justin Renaud.
                  </span>
                  <span className="block">
                    Reach out on{" "}
                    <a
                      href="https://www.linkedin.com/in/just-renaud/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      LinkedIn
                    </a>{" "}
                    or on{" "}
                    <a
                      href={discordInviteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Discord
                    </a>{" "}
                    or by email at justin [dot] tovich [at] gmail [dot] com.
                  </span>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </nav>
      </div>
    </footer>
  );
}
