"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUsersApiGetPrivateUserProfile } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, Mail, User, KeyRound, Edit2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useGetAllauthClientV1AccountEmail,
  usePostAllauthClientV1AccountEmail,
  usePutAllauthClientV1AccountEmail,
} from "@/lib/api/account-email";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

const emailFormSchema = z.object({
  email: z.string().max(254).email("Please enter a valid email address"),
});

export default function ProfileSettingsPage() {
  const {
    data,
    isError: isErrorRetrieving,
    refetch: refetchUserInfo,
  } = useUsersApiGetPrivateUserProfile();
  const { mutateAsync: updateUserEmail, isError: isErrorUpdatingEmail } =
    usePostAllauthClientV1AccountEmail();
  const { data: emailList, isError: isErrorRetrievingEmailList } =
    useGetAllauthClientV1AccountEmail("browser");
  const {
    mutateAsync: resendVerificationEmail,
    isPending: isResendingEmail,
    isError: isErrorResendingEmail,
  } = usePutAllauthClientV1AccountEmail();
  // The following logic works because we know we only have one primary email and if there is another, its the one we want to switch to and isnt verified yet
  const primaryEmail = emailList?.data?.find((email) => email.primary);
  const newEmail = emailList?.data?.find(
    (email) => !email.verified && !email.primary,
  );

  const [showEmailNeedsVerificationAlert, setShowEmailNeedsVerificationAlert] =
    useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [showResendSuccess, setShowResendSuccess] = useState(false);

  const emailForm = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: "",
    },
  });

  useEffect(() => {
    if (primaryEmail?.email) {
      emailForm.setValue("email", primaryEmail.email);
    }
  }, [primaryEmail?.email, emailForm]);

  const onEmailSubmit = async (values: z.infer<typeof emailFormSchema>) => {
    setShowEmailNeedsVerificationAlert(false);
    await updateUserEmail({ client: "browser", data: values });
    await refetchUserInfo();
    emailForm.reset();
    setIsEmailModalOpen(false);
    setShowEmailNeedsVerificationAlert(true);
  };

  const sendVerificationEmailWrapper = async (email: string) => {
    await resendVerificationEmail({
      client: "browser",
      data: { email: email },
    });
    setShowResendSuccess(true);
    setTimeout(() => setShowResendSuccess(false), 3000);
  };

  return (
    <div className="my-4">
      <h1 className="text-2xl font-bold mb-2">Account Settings</h1>
      <p className="text-muted-foreground mb-4">Manage your account here.</p>

      {(isErrorRetrieving || isErrorRetrievingEmailList) && (
        <Alert variant="destructive" className="w-full mb-6">
          <AlertCircleIcon />
          <AlertTitle>Error loading user information</AlertTitle>
          <AlertDescription>
            An unexpected error occurred while trying to load your user
            information. Please try again later.
          </AlertDescription>
        </Alert>
      )}

      {showEmailNeedsVerificationAlert && !isErrorUpdatingEmail && (
        <Alert className="w-full mb-4">
          <Mail className="h-4 w-4" />
          <AlertTitle>Email Update Requested</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <span>
                Please check your new email address for a verification link to
                complete the process.
              </span>
              <Button
                variant="outline"
                onClick={() => setShowEmailNeedsVerificationAlert(false)}
                className="ms-4"
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {isErrorUpdatingEmail && (
        <Alert variant="destructive" className="w-full mb-4">
          <AlertCircleIcon />
          <AlertTitle>Error updating email</AlertTitle>
          <AlertDescription>
            An unexpected error occurred while trying to update your email
            address. Please try again later.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <section className="space-y-3 py-5">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <User className="h-5 w-5" />
              Username
            </h2>
            <p className="text-sm text-muted-foreground">
              Your unique username cannot be changed.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium">{data?.username || "Loading..."}</span>
            <span className="text-sm text-muted-foreground">Cannot be modified</span>
          </div>
        </section>

        <Separator />

        <section className="space-y-4 py-5">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Mail className="h-5 w-5" />
              Email Address
            </h2>
            <p className="text-sm text-muted-foreground">
              Used for account recovery and notifications.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <span className="font-medium">
                {primaryEmail?.email || "Loading..."}
              </span>
              {newEmail && !newEmail.verified && (
                <div className="flex flex-col gap-3">
                  <span className="text-sm text-yellow-600">
                    New email pending verification:{" "}
                    <span className="font-medium">{newEmail.email}</span>
                  </span>
                  <div>
                    <Button
                      onClick={() => sendVerificationEmailWrapper(newEmail.email)}
                      variant="outline"
                      size="sm"
                    >
                      {isResendingEmail
                        ? "Resending..."
                        : showResendSuccess
                          ? "Sent!"
                          : "Resend Verification Email"}
                    </Button>
                  </div>
                </div>
              )}
              {isErrorResendingEmail && (
                <span className="text-sm text-red-600">
                  Error resending verification email. Please try again later.
                </span>
              )}
            </div>
            <Dialog
              open={isEmailModalOpen}
              onOpenChange={setIsEmailModalOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Edit2 className="h-4 w-4" />
                  Change Email
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Change Email Address</DialogTitle>
                  <DialogDescription>
                    Enter your new email address. You&apos;ll need to verify
                    it before the change takes effect.
                  </DialogDescription>
                </DialogHeader>
                <Form {...emailForm}>
                  <form
                    onSubmit={emailForm.handleSubmit(onEmailSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={emailForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter new email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEmailModalOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">Update Email</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        <Separator />

        <section className="space-y-3 py-5">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <KeyRound className="h-5 w-5" />
              Password
            </h2>
            <p className="text-sm text-muted-foreground">
              Change your account password.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium">••••••••••••</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/change-password">Change Password</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
