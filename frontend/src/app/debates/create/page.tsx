import type { Metadata } from "next";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import { AuthRequiredSSR } from "@/components/AuthRedirectsSSR";
import { CreateDebateForm } from "@/app/debates/create/components/CreateDebateForm";
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};


export default async function CreateDebatePage() {
  return (
    <AuthRequiredSSR>
      <NavigationOverlay>
        <div className="container mx-auto max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8">
          <CreateDebateForm />
        </div>
      </NavigationOverlay>
    </AuthRequiredSSR>
  );
}
