import Link from "next/link";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Error starting the sign-in process. Please try again.",
  OAuthCallback: "Error handling the sign-in response. Please try again.",
  OAuthCreateAccount: "Could not create your account. Please try again.",
  OAuthAccountNotLinked:
    "This email is already linked to another sign-in method. Please use the same method you used originally.",
  EmailCreateAccount: "Could not create your account. Please try again.",
  EmailSignin: "Failed to send the magic link. Please try again.",
  Callback: "An error occurred during sign-in. Please try again.",
  SessionRequired: "Please sign in to access this page.",
  Default: "An unexpected error occurred. Please try again.",
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const errorCode = searchParams.error ?? "Default";
  const message =
    ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-4">
      <Card className="w-full max-w-md border-0 bg-white/95 shadow-xl backdrop-blur sm:border">
        <CardHeader className="space-y-1 text-center pb-4">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-destructive">
            Sign-in failed
          </CardTitle>
          <CardDescription className="text-base">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Button asChild className="w-full">
            <Link href="/auth/signin">Try again</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
