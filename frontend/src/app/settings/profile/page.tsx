"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useUsersApiGetPrivateUserProfile,
  useUsersApiUpdatePrivateUserProfile,
} from "@/lib/api/users";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import React, { useEffect } from "react";

const formSchema = z.object({
  bio: z.string().max(2048).optional(),
});

export default function ProfileSettingsPage() {
  const {
    data,
    isLoading: isLoadingBio,
    isError: isErrorRetrieving,
  } = useUsersApiGetPrivateUserProfile();
  const {
    mutateAsync: updateProfileAsync,
    isPending: isPendingSaving,
    isError: isErrorSaving,
  } = useUsersApiUpdatePrivateUserProfile();

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    await updateProfileAsync({ data: data });
  };

  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      bio: data?.bio || "",
    },
    resolver: zodResolver(formSchema),
  });

  // Reset form values when data is loaded, this is needed since data might be fetched after form initialization
  useEffect(() => {
    if (data) {
      form.reset({ bio: data.bio || "" });
    }
  }, [data, form]);

  return (
    <div className={"my-4"}>
      <h1 className="text-2xl font-bold mb-2">Profile Settings</h1>
      <p>Manage your profile information here.</p>
      {isErrorSaving && (
        <Alert variant="destructive" className="w-full">
          <AlertCircleIcon />
          <AlertTitle>Error saving profile information</AlertTitle>
          <AlertDescription>
            An unexpected error occurred while saving your profile information.
            Please try again later.
          </AlertDescription>
        </Alert>
      )}
      {isErrorRetrieving && (
        <Alert variant="destructive" className="w-full">
          <AlertCircleIcon />
          <AlertTitle>Error loading user information</AlertTitle>
          <AlertDescription>
            An unexpected error occurred while trying to load your user
            information. Please try again later.
          </AlertDescription>
        </Alert>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={
                      isLoadingBio ? "Loading..." : "Tell others about yourself"
                    }
                    disabled={isLoadingBio}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isLoadingBio || isPendingSaving}>
            {isPendingSaving ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
