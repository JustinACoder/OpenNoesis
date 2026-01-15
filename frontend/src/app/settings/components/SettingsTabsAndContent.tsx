"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import React from "react";
import { usePathname, useRouter } from "next/navigation";

interface SettingsTabsAndContentProps {
  children: React.ReactNode;
}

const SettingsTabsAndContent = ({ children }: SettingsTabsAndContentProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const currentTab =
    pathname.split("/").filter(Boolean).pop()?.toLowerCase() || "profile";

  const redirectToTab = (tab: string) => {
    router.push(`/settings/${tab}/`);
  };

  return (
    <Tabs value={currentTab} onValueChange={redirectToTab} className="w-full">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>
      <TabsContent value={currentTab}>{children}</TabsContent>
    </Tabs>
  );
};

export default SettingsTabsAndContent;
