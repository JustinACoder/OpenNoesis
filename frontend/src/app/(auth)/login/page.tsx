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
import { Checkbox } from "@/components/ui/checkbox";
import { useSearchParams, useRouter } from "next/navigation";
import type {
  AuthenticationResponse,
  ConflictResponse,
  ErrorResponse,
} from "@/lib/models";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/providers/authProvider";
import { GuestOnly } from "@/components/AuthRedirects";

const formSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
  remember: z.boolean().default(false).optional(),
});

export default function LoginPage() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const nextUrl = searchParams.get("next") || "/";
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });
  const [errorMessages, setErrors] = useState<string[]>([]);

  // Track if the user has successfully logged in
  // We can't use login.isSuccess because it can stay isSuccess after going back to the login page
  // Since it tracks the last mutation state and not whether it was successful for the current page load
  const [hasLoggedIn, setHasLoggedIn] = useState(false);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setErrors([]);
    login
      .mutateAsync({
        client: "browser",
        data: {
          email: values.email,
          password: values.password,
        },
      })
      .then(() => {
        setHasLoggedIn(true);
        router.push(nextUrl);
      })
      .catch(
        (error: ErrorResponse | AuthenticationResponse | ConflictResponse) => {
          const status = error.status;

          if (status === 401) {
            // AuthenticationResponse, we assume this means invalid credentials
            setErrors(["Invalid email or password. Please try again."]);
          } else if (status === 409) {
            // ConflictResponse, what does that mean?
            setErrors(["A conflict occurred. Please try again later."]);
          } else if (status === 400) {
            error = error as ErrorResponse;
            const extractedErrorMessages = error.errors?.map((e) => e.message);
            setErrors(
              extractedErrorMessages || [
                "Invalid request. Please check your input.",
              ],
            );
          } else {
            // Other errors, we can log them or show a generic message
            setErrors([
              "An unexpected error occurred. Please try again later.",
            ]);
          }

          console.error("Login failed:", error);
        },
      );
  }

  return (
    <GuestOnly>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Welcome back
          </CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your account
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="remember"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal">
                          Remember me
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full"
                isLoading={login.isPending}
                disabled={login.isPending || hasLoggedIn}
              >
                {login.isPending
                  ? "Signing in..."
                  : hasLoggedIn
                    ? "Success! You will be redirected soon."
                    : "Sign in"}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                {"Don't have an account? "}
                <Link href="/signup" className="text-primary hover:underline">
                  Sign up
                </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </GuestOnly>
  );
}
