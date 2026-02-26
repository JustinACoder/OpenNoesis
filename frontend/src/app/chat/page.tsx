import { redirect } from "next/navigation";
import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
import { discussionApiGetMostRecentDiscussion } from "@/lib/api/discussions";
import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import NavigationOverlay from "@/components/navigation/NavigationOverlay";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DiscussionSchema } from "@/lib/models";

const ChatPage = async () => {
  // Check authentication in SSR
  const user = await projectOpenDebateApiGetCurrentUserObject();

  if (!user.is_authenticated) {
    redirect("/login");
  }

  // Get the most recent discussion
  let mostRecentDiscussion: DiscussionSchema | null = null;
  try {
    mostRecentDiscussion = await discussionApiGetMostRecentDiscussion();
  } catch (error) {
    console.error("Error fetching most recent discussion:", error);

    // For now, we will assume that this means there are no discussions
    // TODO: ensure that the response code is really 404 and not some other error
    // If we reach here, there are no discussions - show the no discussions page
    return (
      <NavigationOverlay>
        <div className="container mx-auto px-4 py-8">
          <Alert variant="default">
            <AlertCircleIcon />
            <AlertTitle>No Discussions Yet</AlertTitle>
            <AlertDescription>
              <p>
                You don&#39;t have any active discussions. To start chatting
                with other users, you need to join a debate first.
              </p>
              <br />
              <p>How to start a discussion:</p>
              <ol className="list-decimal list-inside">
                <li>
                  Find a debate that interests you in the{" "}
                  <Link href={"/"}>Explore</Link> section
                </li>
                <li>Choose your stance (For or Against)</li>
                <li>Click on &#34;Debate Now&#34; and search for a match</li>
                <li>
                  Get matched with someone of the opposite stance (or the same
                  stance if you prefer)
                </li>
                <li>Start debating through chat!</li>
              </ol>
            </AlertDescription>
          </Alert>
        </div>
      </NavigationOverlay>
    );
  }

  // Redirect to the most recent discussion
  redirect(`/chat/${mostRecentDiscussion.id}`);
};

export default ChatPage;
