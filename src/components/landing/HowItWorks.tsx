/**
 * Band 4: eyebrow, serif heading, then three numbered steps divided by rules.
 * The copy is the real flow: find it, ask for dates, bring it back.
 */

const steps = [
  {
    title: "Find it on the shelf",
    body: "Browse what the circle is lending and filter by category.",
  },
  {
    title: "Request the dates",
    body: "Choose the days you need and send the request. The owner approves or declines.",
  },
  {
    title: "Pick up and pass it back",
    body: "Meet in person, use the tool, and return it when the loan ends.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="ll-container scroll-mt-8 pb-20 lg:pb-26">
      <p className="font-mono text-[10.5px] font-medium tracking-[1.2px] text-primary uppercase">
        How it works
      </p>
      <h2 className="mt-[14px] max-w-[720px] font-serif text-[30px] leading-[34px] font-semibold tracking-[-0.7px] text-foreground sm:text-[38px] sm:leading-[42px]">
        Lend and borrow in three simple steps.
      </h2>

      <ol className="mt-10 grid border-t border-rule-faint md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={
              index === 0
                ? "pt-[30px] md:pr-10"
                : index === 1
                  ? "border-t border-rule-faint pt-[30px] md:border-t-0 md:border-r md:border-l md:px-10"
                  : "border-t border-rule-faint pt-[30px] md:border-t-0 md:pl-10"
            }
          >
            <span
              className={
                index === 1
                  ? "inline-flex size-[34px] items-center justify-center rounded-full bg-primary font-mono text-[11px] font-semibold text-primary-foreground"
                  : "inline-flex size-[34px] items-center justify-center rounded-full bg-foreground font-mono text-[11px] font-semibold text-background"
              }
            >
              0{index + 1}
            </span>
            <h3 className="mt-5 font-serif text-[22px] leading-[28px] font-semibold tracking-[-0.3px] text-foreground">
              {step.title}
            </h3>
            <p className="mt-1 text-[14px] leading-[22px] text-muted-foreground">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
