import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function CheckEmailCard() {
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
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Click the link in the email to verify your account.
          </p>
          <p className="text-sm text-muted-foreground">
            Didn&apos;t receive the email? Check your spam folder. If that still
            doesn&apos;t work, try logging in again to resend the verification
            email.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
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
