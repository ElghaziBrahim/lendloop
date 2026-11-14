import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-6 py-12">
      <Suspense>
        <SignUp fallbackRedirectUrl="/dashboard" />
      </Suspense>
    </div>
  );
}
