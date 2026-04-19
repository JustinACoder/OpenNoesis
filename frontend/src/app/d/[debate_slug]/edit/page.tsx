import type { Metadata } from "next";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
import { debateApiGetDebate } from "@/lib/api/debate";
import { redirect, notFound, unauthorized } from "next/navigation";
import { isApiNotFoundError } from "@/lib/apiError";
import { DebateEditorForm } from "@/app/debates/create/components/DebateEditorForm";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

interface EditDebatePageProps {
  params: Promise<{ debate_slug: string }>;
}

async function getEditableDebateOr404(debateSlug: string) {
  try {
    return await debateApiGetDebate(debateSlug);
  } catch (error) {
    if (isApiNotFoundError(error)) {
      notFound();
    }
    throw error;
  }
}

export default async function EditDebatePage({ params }: EditDebatePageProps) {
  const { debate_slug } = await params;
  const user = await projectOpenDebateApiGetCurrentUserObject();

  if (!user.is_authenticated) {
    redirect("/login");
  }

  const debate = await getEditableDebateOr404(debate_slug);

  if (!debate.author?.id || debate.author.id !== user.id) {
    unauthorized();
  }

  return (
    <NavigationOverlay>
      <div className="container mx-auto max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8">
        <DebateEditorForm mode="edit" debate={debate} />
      </div>
    </NavigationOverlay>
  );
}
