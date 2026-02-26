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
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";
import { usePostAllauthClientV1AuthPasswordReset } from "@/lib/api/authentication-password-reset";
import { getUrlParam } from "@/lib/utils";

const formSchema = z
  .object({
    password: z.string().min(8, {
      message: "Password must be at least 8 characters.",
    }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function ResetPasswordPage() {
  const router = useRouter();
  const [errorMessages, setErrors] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });
  const { mutate: resetPassword, isPending } =
    usePostAllauthClientV1AuthPasswordReset();

  useEffect(() => {
    const key = getUrlParam("token");
    if (!key) {
      router.push("/");
    }
  }, [router]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    setErrors([]);
    setIsSuccess(false);
    const key = getUrlParam("token");
    if (!key) {
      setErrors(["Invalid or missing password reset token."]);
      return;
    }

    resetPassword(
      {
        client: "browser",
        data: {
          key: key, // Non-null assertion since we check for key above
          password: values.password,
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
            // AuthenticationResponse, this simply means the user needs to log in again
            setIsSuccess(true);
          } else if (status === 409) {
            setErrors([
              "There isn't any pending password reset request for this key. Please request a new password reset.",
            ]);
          } else {
            setErrors([
              "An unexpected error occurred. Please try again later.",
            ]);
          }
        },
        onSuccess: () => {
          // technically, this shouldnt happen with our current settings since after reseting the password,
          // we expect a 401 to indicate the user needs to log in again
          console.warn(
            "Password reset successful, but no further action taken.",
          );
          setIsSuccess(true);
        },
      },
    );
  }

  if (isSuccess) {
    return (
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
            Your password has been successfully updated
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              You can now log in with your new password.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Link
            href="/login"
            className="text-center text-sm text-primary hover:underline"
          >
            Continue to login
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Reset password
        </CardTitle>
        <CardDescription className="text-center">
          Enter your new password below
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      id="password"
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
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input
                      id="confirmPassword"
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
              <p>Password must contain:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>At least 8 characters</li>
                <li>At least one non-numeric character</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isPending || errorMessages.length > 0}
            >
              {isPending ? "Updating..." : "Update Password"}
            </Button>
            <Link
              href="/login"
              className="text-center text-sm text-muted-foreground hover:text-primary"
            >
              Back to login
            </Link>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
