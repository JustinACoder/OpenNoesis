import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import NotificationsClient from "./components/NotificationsClient";
import { Footer } from "@/components/Footer";

export default function NotificationsPage() {
  return (
    <NavigationOverlay>
      <NotificationsClient />
      <Footer />
    </NavigationOverlay>
  );
}
