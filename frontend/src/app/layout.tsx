import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import React from "react";
import Providers from "@/providers/providers";
import { getProjectOpenDebateApiGetCurrentUserObjectQueryOptions } from "@/lib/api/general";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getGetAllauthClientV1AuthSessionQueryOptions } from "@/lib/api/authentication-current-session";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenNoesis",
  description: "Expanding minds through thoughtful debate",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // TODO: Since we make a request in the root layout, we completely lose the benefits of static generation.
  // We should consider reformatting the code to use as much static generation as possible

  // Prefetch the user profile every time a page is loaded
  const queryClient = new QueryClient();
  const currentUserQueryOptions =
    getProjectOpenDebateApiGetCurrentUserObjectQueryOptions();
  const currentSessionQueryOptions =
    getGetAllauthClientV1AuthSessionQueryOptions("browser");
  await Promise.all([
    queryClient.prefetchQuery(currentUserQueryOptions),
    queryClient.prefetchQuery(currentSessionQueryOptions),
  ]);

  // Create the dehydrated state for the Providers
  const dehydratedState = dehydrate(queryClient);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground dark`}
      >
        <Providers dehydratedState={dehydratedState}>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </Providers>
      </body>
    </html>
  );
}
