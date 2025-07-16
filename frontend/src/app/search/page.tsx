import { Footer } from "@/components/Footer";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import SearchClient from "@/app/search/components/SearchClient";

// TODO: Instead of having a client component, the page could be client and we have a server layout
export default function SearchPage() {
  return (
    <NavigationOverlay>
      <SearchClient />
      <Footer />
    </NavigationOverlay>
  );
}
