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
import { usePostAllauthClientV1AuthPasswordRequest } from "@/lib/api/authentication-password-reset";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

export default function ForgotPasswordPage() {
  const [errorMessages, setErrors] = useState<string[]>([]);

  const {
    mutate: requestPasswordReset,
    isPending,
    isSuccess,
  } = usePostAllauthClientV1AuthPasswordRequest();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setErrors([]);

    requestPasswordReset(
      {
        client: "browser",
        data: {
          email: values.email,
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
            // This doesnt mean failure, it simply indicates the next step of the flow
            // In our case, ACCOUNT_PASSWORD_RESET_BY_CODE_ENABLED = False, so we should not expect this
            // Therefore, we will treat it as an unexpected error
            setErrors([
              "An unexpected authentication error occurred. Please try again later.",
            ]);
          } else {
            setErrors([
              "An unexpected error occurred. Please try again later.",
            ]);
          }
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
            Check your email
          </CardTitle>
          <CardDescription className="text-center">
            If an account with that email exists, we&#39;ve sent you a password
            reset link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Click the link in the email to reset your password.
            </p>
            <p className="text-sm text-muted-foreground">
              {"Didn't receive the email? Check your spam folder."}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Link
            href="/login"
            className="flex items-center justify-center text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to login
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Forgot password?
        </CardTitle>
        <CardDescription className="text-center">
          {"No worries! Enter your email and we'll send you a reset link"}
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Sending..." : "Send Reset Link"}
            </Button>
            <Link
              href="/login"
              className="flex items-center justify-center text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to login
            </Link>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
