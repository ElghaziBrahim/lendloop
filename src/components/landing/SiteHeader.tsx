import Link from "next/link";

/**
 * The design's public header: 76 px, cream ground, a solid 26 px mark, three
 * semibold links and one dark pill. It is static, not sticky.
 */

const links = [
  { href: "#how", label: "How it works" },
  { href: "#shelf", label: "Explore tools" },
  { href: "#why", label: "Why LendLoop" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="ll-container flex h-[76px] items-center gap-6 lg:gap-[52px]">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-[10px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span
            aria-hidden="true"
            className="block size-[26px] rounded-full bg-foreground"
          />
          <span className="font-serif text-[21px] font-semibold tracking-[-0.3px] whitespace-nowrap">
            LendLoop
          </span>
        </Link>

        <nav
          aria-label="Main"
          className="hidden items-center gap-[34px] md:flex"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold whitespace-nowrap text-inverse transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/sign-up"
          className="ml-auto inline-flex h-[42px] items-center rounded-sm bg-foreground px-5 text-sm font-semibold whitespace-nowrap text-inverse-foreground transition-colors hover:bg-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Get started
        </Link>
      </div>
    </header>
  );
}
