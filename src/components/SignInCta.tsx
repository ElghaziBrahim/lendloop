"use client";

import { SignInButton } from "@clerk/nextjs";

/**
 * The one way into the app from the public page.
 *
 * A modal keeps the visitor on the listing they were reading, and the forced
 * redirect sends them to the dashboard as soon as Clerk finishes the sign-in
 * (or the sign-up they switch to inside the same modal).
 */
const primaryStyles =
  "inline-flex h-[46px] items-center justify-center rounded-sm bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:hover:bg-primary dark:hover:brightness-110";

const quietStyles =
  "inline-flex h-[42px] items-center justify-center rounded-sm border border-input bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:border-rule-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type SignInCtaProps = {
  variant?: "primary" | "quiet";
  label?: string;
};

export function SignInCta({
  variant = "primary",
  label = "Sign in to lend or borrow",
}: SignInCtaProps) {
  return (
    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
      <button
        type="button"
        className={variant === "primary" ? primaryStyles : quietStyles}
      >
        {label}
      </button>
    </SignInButton>
  );
}
