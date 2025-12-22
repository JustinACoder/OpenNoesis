import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import React from "react";
import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
import { redirect } from "next/navigation";
import SettingsUserBanner from "@/app/settings/components/SettingsUserBanner";
import SettingsTabsAndContent from "@/app/settings/components/SettingsTabsAndContent";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication in SSR
  const user = await projectOpenDebateApiGetCurrentUserObject();

  if (!user.is_authenticated) {
    redirect("/login");
  }

  return (
    <NavigationOverlay show_footer={false}>
      <div className="container m-auto px-4 py-8 space-y-8">
        {/* Account Overview Card */}
        <SettingsUserBanner />

        {/* Tabs */}
        <SettingsTabsAndContent>{children}</SettingsTabsAndContent>
      </div>
    </NavigationOverlay>
  );
}
