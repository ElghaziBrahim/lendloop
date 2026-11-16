import { Suspense } from "react";
import {
  PublicToolList,
  PublicToolListSkeleton,
} from "@/components/PublicToolList";
import { CallToAction } from "@/components/landing/CallToAction";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { WhyBand } from "@/components/landing/WhyBand";

/**
 * The public page, in the seven bands of the OpenPencil landing frame:
 * header, hero, shelf, how it works, why, call to action, footer.
 *
 * Everything above the shelf is static. The tool list streams in from Convex
 * at request time and exposes only each tool's name and category, so the shell
 * can render before Convex answers and the HTML still carries no owner.
 *
 * A signed-in visitor is redirected to `/dashboard` by the proxy, so this page
 * is always the signed-out view.
 */
/**
 * The header reads the session to choose between "Get started" and "Open the
 * app", so the page renders per request instead of prerendering a shell.
 */
export const instant = false;

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col overflow-x-clip bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1">
        <Hero />

        <section id="shelf" className="ll-container scroll-mt-8 pb-24">
          <h2 className="sr-only">On the shelf</h2>
          <Suspense fallback={<PublicToolListSkeleton />}>
            <PublicToolList />
          </Suspense>
        </section>

        <HowItWorks />
        <WhyBand />
        <CallToAction />
      </main>

      <SiteFooter />
    </div>
  );
}
