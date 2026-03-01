import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import { AuthRequiredSSR } from "@/components/AuthRedirectsSSR";
import { CreateDebateForm } from "@/app/debates/create/components/CreateDebateForm";

export default async function CreateDebatePage() {
  return (
    <AuthRequiredSSR>
      <NavigationOverlay>
        <div className="container mx-auto px-4 py-8">
          <CreateDebateForm />
        </div>
      </NavigationOverlay>
    </AuthRequiredSSR>
  );
}
