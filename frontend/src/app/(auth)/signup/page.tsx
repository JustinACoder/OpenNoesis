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
import { GuestOnly } from "@/components/AuthRedirects";
import { usePostAllauthClientV1AuthSignup } from "@/lib/api/authentication-account";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const formSchema = z
  .object({
    username: z.string().min(3, {
      message: "Username must be at least 3 characters.",
    }),
    email: z.string().email({
      message: "Please enter a valid email address.",
    }),
    password: z.string().min(8, {
      message: "Password must be at least 8 characters.",
    }),
    confirmPassword: z.string(),
    terms: z.boolean().refine((value) => value, {
      message: "You must accept the terms and conditions.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const nextUrl = searchParams.get("next") || "/";
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });
  const { mutate: signup, isPending } = usePostAllauthClientV1AuthSignup();
  const [errorMessages, setErrors] = useState<string[]>([]);

  const [hasSignedUp, setHasSignedUp] = useState(false);

  function onSubmit(values: z.infer<typeof formSchema>) {
    setErrors([]);
    signup(
      {
        client: "browser",
        data: {
          username: values.username,
          email: values.email,
          password: values.password,
        },
      },
      {
        onError: (err) => {
          if (err.status === 400) {
            setErrors(
              err.errors?.map((error) => error.message) || [
                "An error occurred. Please try again.",
              ],
            );
          } else if (err.status === 401) {
            // AuthenticationResponse, this can happen if we have successfully signed up but need another step
            // In this case, it should always be about pending email verification
            // TODO: if we ever implement other flows (like MFA), handle them here as well
            const doesPendingEmailVerifExists = err.data.flows?.some(
              (f) => f.id === "verify_email" && f.is_pending === true,
            );
            if (doesPendingEmailVerifExists) {
              router.push("/verify-email");
            } else {
              setErrors(["An unexpected authentication error occurred."]);
              console.error("Signup failed:", err);
            }
          } else if (err.status === 403) {
            setErrors([
              "Signup is closed at the moment. Please try again later.",
            ]);
          } else if (err.status === 409) {
            setErrors([
              "You are already logged in. Please log out before signing up again.",
            ]);
          } else {
            setErrors([
              "An unexpected error occurred. Please try again later.",
            ]);
          }
        },
        onSuccess: () => {
          setHasSignedUp(true);
          router.push(nextUrl);
        },
      },
    );
  }

  return (
    <GuestOnly>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Create account
          </CardTitle>
          <CardDescription className="text-center">
            Enter your information to get started
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
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="johndoe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="john@example.com" {...field} />
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
                        placeholder="Create a strong password"
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
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirm your password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm">
                        I agree to the{" "}
                        <Link
                          href="/terms"
                          className="text-primary hover:underline"
                        >
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link
                          href="/privacy"
                          className="text-primary hover:underline"
                        >
                          Privacy Policy
                        </Link>
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full"
                isLoading={isPending}
                disabled={hasSignedUp || isPending}
              >
                {isPending
                  ? "Creating account..."
                  : hasSignedUp
                    ? "Account created! You will be redirected soon..."
                    : "Create account"}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </GuestOnly>
  );
}
