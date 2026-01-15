import { notFound, redirect } from "next/navigation";
import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
import { DiscussionPageClientWrapper } from "./components/DiscussionPageClientWrapper";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";

interface DiscussionPageProps {
  params: Promise<{ discussion_id: string }>;
  children: React.ReactNode;
}

const DiscussionPage = async ({ params, children }: DiscussionPageProps) => {
  // Only check authentication in SSR, no data fetching
  const user = await projectOpenDebateApiGetCurrentUserObject();

  if (!user.is_authenticated) {
    redirect("/login");
  }

  const { discussion_id } = await params;
  const discussionId = parseInt(discussion_id, 10);

  if (isNaN(discussionId)) {
    notFound();
  }

  return (
    <NavigationOverlay
      hide_bottom_menu={true}
      show_footer={false}
      main_y_scroll={false}
      header_full_width={true}
    >
      <DiscussionPageClientWrapper discussionId={discussionId}>
        {children}
      </DiscussionPageClientWrapper>
    </NavigationOverlay>
  );
};

export default DiscussionPage;
