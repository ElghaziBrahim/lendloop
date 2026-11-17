import Image from "next/image";
import { CheckIcon } from "@/components/landing/icons";

/**
 * Band 5: the warm sand band with the framed photograph on the left and the
 * second serif heading on the right, followed by three ruled checks.
 *
 * The photograph is illustrative, not a customer; the three rows are benefits
 * the product can actually keep, with no number attached to any of them.
 */

const points = [
  "Save money on the things you only need occasionally.",
  "Clear the clutter and make better use of what you own.",
  "Share with the people in your circle.",
];

export function WhyBand() {
  return (
    <section id="why" className="scroll-mt-8 bg-sand-200 dark:bg-card">
      <div className="ll-container grid items-center gap-12 py-20 lg:grid-cols-[560px_minmax(0,1fr)] lg:gap-24 lg:py-26">
        <div className="border border-rule-warm bg-photo p-[18px]">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-photo-tint lg:aspect-[14/15]">
            <Image
              src="/images/why-circle.jpg"
              alt="A gardener kneeling behind a low herb bed in late afternoon light."
              fill
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover object-center"
            />
          </div>
        </div>

        <div className="min-w-0">
          <p className="font-mono text-[10.5px] font-medium tracking-[1.2px] text-primary uppercase">
            Why LendLoop
          </p>
          <h2 className="mt-[14px] max-w-[620px] font-serif text-[30px] leading-[34px] font-semibold tracking-[-0.7px] text-foreground sm:text-[38px] sm:leading-[42px]">
            Good tools deserve more than one owner.
          </h2>

          <ul className="mt-7 max-w-[620px]">
            {points.map((point, index) => (
              <li
                key={point}
                className={
                  index === points.length - 1
                    ? "flex items-start gap-4 border-t border-b border-photo-warm py-[22px]"
                    : "flex items-start gap-4 border-t border-photo-warm py-[22px]"
                }
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-primary">
                  <CheckIcon className="size-4" />
                </span>
                <span className="text-[15px] leading-[24px] text-foreground">
                  {point}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
