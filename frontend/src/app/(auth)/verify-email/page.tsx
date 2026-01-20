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
import { Mail, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { usePostAllauthClientV1AuthEmailVerify } from "@/lib/api/authentication-account";
import { getUrlParam } from "@/lib/utils";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [errorMessages, setErrors] = useState<string[]>([]);

  // const { mutate: resendVerificationEmail, isPending: isResending } =
  //   usePostAllauthClientV1AuthEmailVerifyResend();
  const {
    mutateAsync: verifyEmail,
    isPending: isVerifying,
    isSuccess: isVerified,
  } = usePostAllauthClientV1AuthEmailVerify();

  // If there's a verification code in the URL, attempt to verify automatically
  useEffect(() => {
    const key = getUrlParam("token");

    if (key && !isVerifying && !isVerified) {
      verifyEmail(
        {
          client: "browser",
          data: {
            key: key,
          },
        },
        {
          onError: (error) => {
            const status = error.status;

            if (status === 400) {
              const extractedErrorMessages = error.errors?.map(
                (e) => e.message,
              );
              setErrors(
                extractedErrorMessages || ["Invalid verification code."],
              );
            } else if (status === 401) {
              // This doesnt mean failure, it means the verification was successful but the user is not authenticated
              // In this case, we want to redirect to login
              router.push("/login");
            } else if (status === 409) {
              setErrors(["There isn't any pending verification flow."]);
            } else {
              setErrors([
                "An unexpected error occurred. Please try again later.",
              ]);
            }
          },
        },
      ).then(() => {
        console.log("Email verification successful");
      });
    }
  }, [isVerifying, isVerified, verifyEmail, router]);

  // function handleResendEmail() {
  //   setErrors([]);
  //
  //   resendVerificationEmail(
  //     {
  //       client: "browser",
  //     },
  //     {
  //       onError: (error) => {
  //         const status = error.status;
  //
  //         if (status === 409) {
  //           setErrors(["There isn't any pending verification flow."]);
  //         } else if (status === 429) {
  //           setErrors([
  //             "Too many requests. Please wait a few minutes before trying again.",
  //           ]);
  //         } else {
  //           setErrors([
  //             "An unexpected error occurred while resending the verification email. Please try again later.",
  //           ]);
  //         }
  //       },
  //       onSuccess: () => {
  //         toast.success(
  //           "Verification email sent successfully! Please check your inbox.",
  //         );
  //       },
  //     },
  //   );
  // }

  // If we're in the process of verifying with a code
  if (isVerifying) {
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

  // If verification was successful
  if (isVerified) {
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
        <CardFooter className="flex flex-col space-y-4">
          <Button onClick={() => router.push("/")} className="w-full">
            Continue to Dashboard
          </Button>
          <Link
            href="/login"
            className="text-center text-sm text-primary hover:underline"
          >
            Go to login
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Default view when no verification code is provided or verification failed
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-center">
          Check your email
        </CardTitle>
        <CardDescription className="text-center">
          {"We've sent a verification link to your email address"}
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
            Click the link in the email to verify your account.
          </p>
          <p className="text-sm text-muted-foreground">
            Didn&#39;t receive the email? Check your spam folder. If that still
            doesn&#39;t work, try logging in again to resend the verification
            email.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        {/*<Button*/}
        {/*  variant="outline"*/}
        {/*  className="w-full bg-transparent"*/}
        {/*  onClick={handleResendEmail}*/}
        {/*  disabled={isResending}*/}
        {/*>*/}
        {/*  {isResending ? "Sending..." : "Resend Verification Email"}*/}
        {/*</Button>*/}
        <div className="text-center space-y-2">
          <Link
            href="/login"
            className="text-sm text-primary hover:underline block"
          >
            Back to login
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
