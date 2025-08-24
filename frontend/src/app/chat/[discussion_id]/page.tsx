import { notFound, redirect } from "next/navigation";
import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
import { DiscussionPageClient } from "./components/DiscussionPageClient";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";

interface DiscussionPageProps {
  params: Promise<{ discussion_id: string }>;
}

const DiscussionPage = async ({ params }: DiscussionPageProps) => {
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
      <DiscussionPageClient discussionId={discussionId} />
    </NavigationOverlay>
  );
};

export default DiscussionPage;
