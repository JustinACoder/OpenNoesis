import type { Metadata } from "next";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import NotificationsClient from "./components/NotificationsClient";
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};


export default function NotificationsPage() {
  return (
    <NavigationOverlay>
      <NotificationsClient />
    </NavigationOverlay>
  );
}
