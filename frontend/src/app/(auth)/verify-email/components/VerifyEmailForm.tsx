"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { usePostAllauthClientV1AuthEmailVerify } from "@/lib/api/authentication-account";

interface VerifyEmailFormProps {
  token: string;
}

// Module-level variable to ensure single verification attempt
// even if the component is mounted multiple times (e.g., React Strict Mode)
// In production, this component should only mount once per page load
// so this is only relevant for development mode with Strict Mode enabled
let hasVerified = false;

export default function VerifyEmailForm({ token }: VerifyEmailFormProps) {
  const router = useRouter();
  const [errorMessages, setErrors] = useState<string[]>([]);
  const [isVerifiedAndLoggedOut, setIsVerifiedAndLoggedOut] = useState(false);

  const { mutate: verifyEmail, isSuccess: isVerifiedAndLoggedIn } =
    usePostAllauthClientV1AuthEmailVerify();

  // Attempt verification on mount
  useEffect(() => {
    // This ensures we only verify once even if useEffect runs multiple times (e.g., in React Strict Mode)
    // In production, this effect should only run once anyway
    if (hasVerified) return;
    hasVerified = true;

    verifyEmail(
      {
        client: "browser",
        data: {
          key: token,
        },
      },
      {
        onError: (error) => {
          const status = error.status;

          if (status === 400) {
            const extractedErrorMessages = error.errors?.map((e) => e.message);
            setErrors(extractedErrorMessages || ["Invalid verification code."]);
          } else if (status === 401) {
            // Verification was successful but user is not authenticated
            // Redirect to login
            // This is the success case for email verification
            // We could directly redirect to login here, but to give better UX we show a success message first
            // and let user choose when to go to login
            // Therefore, we do nothing here and let isVerified handle the success state
            setIsVerifiedAndLoggedOut(true);
          } else if (status === 409) {
            setErrors(["There isn't any pending verification flow."]);
          } else {
            setErrors([
              "An unexpected error occurred. Please try again later.",
            ]);
          }
        },
      },
    );
  }, []);

  if (errorMessages.length > 0) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Verification failed
          </CardTitle>
          <CardDescription className="text-center">
            We couldn&apos;t verify your email address
          </CardDescription>
        </CardHeader>
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
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              The verification link may have expired or already been used. Try
              logging in again to resend the verification email.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Link href="/login" className="w-full">
            <Button className="w-full">Back to login</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Verification successful
  if (isVerifiedAndLoggedIn || isVerifiedAndLoggedOut) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Email verified!
          </CardTitle>
          <CardDescription className="text-center">
            Your email address has been successfully verified
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              You can now access all features of your account.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          {isVerifiedAndLoggedIn && (
            <Button
              onClick={() => router.push("/dashboard")}
              className="w-full mb-2"
            >
              Go to dashboard
            </Button>
          )}
          {isVerifiedAndLoggedOut && (
            <Button
              onClick={() => router.push("/login")}
              className="w-full mb-2"
            >
              Go to login
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  // Verification in progress
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Verifying your email...
        </CardTitle>
        <CardDescription className="text-center">
          Please wait while we verify your email address
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </CardContent>
    </Card>
  );
}
