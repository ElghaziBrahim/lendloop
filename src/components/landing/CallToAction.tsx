import Image from "next/image";
import Link from "next/link";

/**
 * Band 6: the dark closing panel. Copy on the left, the workbench photograph
 * framed on the right, one cream button.
 */

export function CallToAction() {
  return (
    <section className="bg-foreground">
      <div className="grid lg:grid-cols-[minmax(0,700px)_minmax(0,1fr)]">
        <div className="flex flex-col justify-center px-6 py-14 sm:px-12 lg:py-24 lg:pl-24 lg:pr-16">
          <p className="font-mono text-[10.5px] font-medium tracking-[1.2px] text-inverse-muted uppercase dark:text-neutral-700">
            Start lending
          </p>
          <h2 className="mt-[14px] max-w-[560px] font-serif text-[32px] leading-[36px] font-semibold tracking-[-0.7px] text-inverse-foreground sm:text-[42px] sm:leading-[46px]">
            Have something gathering dust?
          </h2>
          <p className="mt-[14px] max-w-[540px] text-[15px] leading-[24px] text-inverse-muted dark:text-neutral-700">
            That drill, ladder or pressure washer could be back at work. List it
            in a minute and lend it to someone in your circle.
          </p>
          <Link
            href="/sign-in"
            className="mt-8 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-sm bg-background px-[26px] text-[15px] font-semibold text-foreground transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto sm:self-start"
          >
            List your first tool
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

        <div className="p-[18px]">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-inverse lg:aspect-auto lg:h-full lg:min-h-[420px] dark:bg-photo">
            <Image
              src="/images/cta-workbench.jpg"
              alt="A garden shed workbench with a toolbox, a rake and a potted plant."
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
