import Image from "next/image";
import Link from "next/link";
import { ShieldIcon } from "@/components/landing/icons";

/**
 * Band 2: the serif headline, the lead paragraph, the rust primary and the
 * outlined secondary, then the privacy line. The photograph sits in a framed
 * panel on the right from lg up and below the copy on a phone.
 */

export function Hero() {
  return (
    <section className="ll-container pt-12 pb-16 lg:pt-20">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,592px)_minmax(0,1fr)] lg:gap-16">
        <div className="min-w-0">
          <p className="font-mono text-[11.5px] font-medium tracking-[1.5px] text-primary uppercase">
            A shared shelf for your circle
          </p>

          <h1 className="mt-[22px] font-serif text-[42px] leading-[44px] font-semibold tracking-[-1px] text-foreground sm:text-[54px] sm:leading-[58px] lg:text-[64px] lg:leading-[68px] xl:text-[72px] xl:leading-[76px] xl:tracking-[-1.6px]">
            Lend what you have. Borrow what you need.
          </h1>

          <p className="mt-[26px] max-w-[520px] text-[17px] leading-[28px] text-muted-foreground">
            LendLoop keeps the tools you already own moving: list one, borrow
            one for a few days, and bring it back when you are done.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-[14px]">
            <Link
              href="#shelf"
              className="inline-flex h-[52px] items-center justify-center rounded-sm bg-primary px-[26px] text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Explore the shelf
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-[52px] items-center justify-center rounded-sm border border-input bg-card px-[25px] text-[15px] font-semibold text-foreground transition-colors hover:border-rule-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              List something to lend
            </Link>
          </div>

          <p className="mt-[26px] flex items-center gap-2 text-[13px] text-subtle-foreground">
            <ShieldIcon className="size-3.5 shrink-0 text-rule-soft" />
            Only a tool&rsquo;s name and category are public.
          </p>
        </div>

        <div className="min-w-0 border border-rule-warm bg-photo p-[18px]">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-photo-tint lg:aspect-[556/492]">
            <Image
              src="/images/hero-handover.jpg"
              alt="One neighbour handing a cordless drill to another over a garden gate."
              fill
              priority
              sizes="(min-width: 1024px) 592px, 100vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
