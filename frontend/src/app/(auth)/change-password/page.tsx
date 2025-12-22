"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { usePostAllauthClientV1AccountPasswordChange } from "@/lib/api/account-password";
import { AuthRequired } from "@/components/AuthRedirects";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const formSchema = z
  .object({
    currentPassword: z.string().min(1, {
      message: "Current password is required.",
    }),
    newPassword: z.string().min(8, {
      message: "Password must be at least 8 characters.",
    }),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords don't match",
    path: ["confirmNewPassword"],
  });

export default function ChangePasswordPage() {
  const [errorMessages, setErrors] = useState<string[]>([]);
  const router = useRouter();

  const {
    mutate: changePassword,
    isPending,
    isSuccess,
  } = usePostAllauthClientV1AccountPasswordChange();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setErrors([]);

    changePassword(
      {
        client: "browser",
        data: {
          current_password: values.currentPassword,
          new_password: values.newPassword,
        },
      },
      {
        onError: (error) => {
          const status = error.status;

          if (status === 400) {
            const extractedErrorMessages = error.errors?.map((e) => e.message);
            setErrors(
              extractedErrorMessages || [
                "Invalid request. Please check your input.",
              ],
            );
          } else if (status === 401) {
            // AuthenticationResponse, in this case, 401 means the user is not logged in or session expired
            // Technically, it could also be because email isnt verified, but in that case, we just redirect to login anyway
            toast.error(
              "Your are not logged in or session has expired. Please log in again.",
            );
            router.push("/login");
          } else {
            setErrors([
              "An unexpected error occurred. Please try again later.",
            ]);
          }
        },
        onSuccess: () => {
          console.log("Password change successful");
          form.reset(); // Reset the form on success
        },
      },
    );
  }

  if (isSuccess) {
    return (
      <AuthRequired>
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Password updated!
            </CardTitle>
            <CardDescription className="text-center">
              Your password has been successfully changed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Make sure to remember your new password for future logins!
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Link
              href="/settings/account/"
              className="flex items-center justify-center text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to account settings
            </Link>
          </CardFooter>
        </Card>
      </AuthRequired>
    );
  }

  return (
    <AuthRequired>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Change password
          </CardTitle>
          <CardDescription className="text-center">
            Change your account password securely
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <CardContent className="space-y-4">
              {errorMessages.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {errorMessages.map((message, index) => (
                      <div key={index}>{message}</div>
                    ))}
                  </AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your current password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your new password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmNewPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirm your new password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="text-sm text-muted-foreground">
                <p>Password requirements:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>At least 8 characters long</li>
                  <li>At least one non-numeric character</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Updating..." : "Update Password"}
              </Button>
              <Link
                href="/settings/account/"
                className="flex items-center justify-center text-sm text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to account settings
              </Link>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </AuthRequired>
  );
}
