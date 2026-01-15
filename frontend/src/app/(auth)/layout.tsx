import type React from "react";
import Link from "next/link";
import ClickableLogo from "@/components/ClickableLogo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50">
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

      {/* Main Content with top padding to account for fixed header */}
      <main className="min-h-screen flex items-center justify-center bg-background px-4 pt-16">
        {children}
      </main>
    </>
  );
}
