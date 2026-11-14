import { Suspense } from "react";
import {
  PublicToolList,
  PublicToolListSkeleton,
} from "@/components/PublicToolList";
import { SignInCta } from "@/components/SignInCta";

/**
 * The public page. Everything above the shelf is a static shell; the tool list
 * streams in from Convex at request time and exposes only name and category.
 *
 * A signed-in visitor is redirected to `/dashboard` by the middleware, so this
 * page is always the signed-out view.
 */

const steps = [
  {
    title: "List a tool",
    body: "Put the drill, the ladder, the tent on the shelf.",
  },
  {
    title: "Ask for dates",
    body: "Request the days you need and the owner approves.",
  },
  {
    title: "Return it",
    body: "Bring it back and close the loop for the next person.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight">
            Lend<span className="text-emerald-700 dark:text-emerald-400">Loop</span>
          </span>
          <SignInCta variant="quiet" label="Sign in" />
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-14 sm:pt-24 sm:pb-20">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-emerald-700 uppercase dark:text-emerald-400">
                A shared shelf for your circle
              </p>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Lend what you have. Borrow what you need.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
                LendLoop keeps the tools you already own moving: list one,
                borrow one for a few days, and bring it back when you are done.
              </p>
              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <SignInCta />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Signing in creates your account.
                </p>
              </div>
            </div>

            <ol className="grid gap-3">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="font-mono text-xs leading-6 text-emerald-700 dark:text-emerald-400">
                    0{index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mx-auto w-full max-w-5xl px-6 py-14">
            <Suspense fallback={<PublicToolListSkeleton />}>
              <PublicToolList />
            </Suspense>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between dark:text-zinc-400">
          <p>LendLoop — lend and borrow tools within a circle you trust.</p>
          <p>Next.js · Clerk · Convex</p>
        </div>
      </footer>
    </div>
  );
}
