import type { Metadata } from "next";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import React from "react";
import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function MyDebatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await projectOpenDebateApiGetCurrentUserObject();

  if (!user.is_authenticated) {
    redirect("/login");
  }

  return (
    <NavigationOverlay show_footer={false}>
      <div className="container m-auto space-y-8 px-4 py-8">{children}</div>
    </NavigationOverlay>
  );
}
