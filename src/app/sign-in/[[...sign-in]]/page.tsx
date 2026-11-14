import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-6 py-12">
      <Suspense>
        <SignIn fallbackRedirectUrl="/dashboard" />
      </Suspense>
    </div>
  );
}
