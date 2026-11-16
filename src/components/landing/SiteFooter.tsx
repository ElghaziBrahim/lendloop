import Link from "next/link";

/**
 * Band 7: the dark footer. Wordmark, tagline, the three anchors and sign-in,
 * then the mono microcopy line.
 *
 * The reference also shows Privacy and Terms. The app has no such pages, and a
 * dead legal link is worse than a missing one, so they are left out until the
 * pages exist.
 */

const links = [
  { href: "#how", label: "How it works" },
  { href: "#shelf", label: "Explore tools" },
  { href: "#why", label: "Why LendLoop" },
  { href: "/sign-in", label: "Sign in" },
];

export function SiteFooter() {
  return (
    <footer className="bg-foreground">
      <div className="ll-container py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <span
                aria-hidden="true"
                className="block size-5 rounded-full bg-background"
              />
              <span className="font-serif text-[21px] font-semibold tracking-[-0.3px] text-inverse-foreground">
                LendLoop
              </span>
            </Link>
            <p className="text-[13px] text-inverse-muted">
              A shared shelf for your circle.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-6 gap-y-2 sm:flex sm:flex-wrap sm:items-center sm:gap-[34px]"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13px] font-medium text-inverse-muted transition-colors hover:text-inverse-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-8 border-t border-inverse pt-5 font-mono text-[9.5px] tracking-[0.9px] text-inverse-muted uppercase">
          LendLoop · Neighbourhood tool lending · Only a tool&rsquo;s name and
          category are public
        </p>
      </div>
    </footer>
  );
}
