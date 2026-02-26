import { ReactNode } from "react";
import { projectOpenDebateApiGetCurrentUserObject } from "@/lib/api/general";
import { redirect } from "next/navigation";

const AuthRequiredSSR = async ({ children }: { children: ReactNode }) => {
  const user = await projectOpenDebateApiGetCurrentUserObject();
  if (user.is_anonymous) {
    redirect("/login");
  }

  // If the user is authenticated, render the children
  return children;
};

const GuestOnlySSR = async ({ children }: { children: ReactNode }) => {
  const user = await projectOpenDebateApiGetCurrentUserObject();
  if (user.is_authenticated) {
    redirect("/");
  }

  // If the user is unauthenticated, render the children
  return children;
};

export { AuthRequiredSSR, GuestOnlySSR };
