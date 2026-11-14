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
  "inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:outline-zinc-50";

const quietStyles =
  "inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-400 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-50";

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
