import type React from "react";
import Link from "next/link";
import ClickableLogo from "@/components/ClickableLogo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <header className="sticky top-0 shrink-0 z-50 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <ClickableLogo />

            {/* Optional: Add a subtle "Back to home" text for better UX */}
            <Link
              href="/"
              className="text-sm hover:text-primary transition-colors hidden sm:block"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content - scrollable if needed */}
      <main className="flex-1 flex items-center justify-center bg-background px-4 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
