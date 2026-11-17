import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

/**
 * The small set of presentational pieces every screen uses. They are styled
 * from the design tokens in `globals.css` (the OpenPencil "LendLoop — Full
 * app" document), so a palette change lands here once and reaches every page.
 */

export function cx(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export type Tone = "neutral" | "emerald" | "amber" | "red" | "blue";

/**
 * Status stamps, not pills: small mono capitals on a tint, matching the
 * exported `BadgeLabel` / `BadgeStatusStamp` components.
 */
const badgeTones: Record<Tone, string> = {
  neutral: "bg-neutral-tint text-neutral-800 dark:text-neutral",
  emerald: "bg-positive-tint text-positive-strong",
  amber: "bg-warn-tint text-warn-strong",
  red: "bg-danger-tint text-danger-strong",
  blue: "bg-info-tint text-chart-4",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-[22px] items-center gap-1 rounded-[2px] px-[7px] font-mono text-[9.5px] font-medium tracking-[0.6px] whitespace-nowrap uppercase",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusTones: Record<string, Tone> = {
  active: "emerald",
  approved: "emerald",
  pending: "amber",
  overdue: "red",
  declined: "red",
  returned: "neutral",
  removed: "neutral",
  cancelled: "neutral",
};

const statusLabels: Record<string, string> = {
  active: "Active",
  approved: "Approved",
  pending: "Pending",
  overdue: "Overdue",
  declined: "Declined",
  returned: "Returned",
  removed: "Removed",
  cancelled: "Cancelled",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return (
    <Badge tone={statusTones[status] ?? "neutral"}>
      {label ?? statusLabels[status] ?? status}
    </Badge>
  );
}

type Variant = "primary" | "secondary" | "danger" | "quiet";
type Size = "sm" | "md";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60";

const buttonVariants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-accent-hover focus-visible:outline-primary dark:hover:bg-primary dark:hover:brightness-110",
  secondary:
    "border border-input bg-card text-foreground hover:border-rule-dark focus-visible:outline-ring",
  danger:
    "border border-danger-tint-strong bg-danger-tint text-danger-strong hover:bg-danger-tint-soft focus-visible:outline-destructive",
  quiet:
    "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-ring",
};

const buttonSizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px]",
  md: "h-[42px] px-4 text-[13.5px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return cx(buttonBase, buttonVariants[variant], buttonSizes[size]);
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClass(variant, size), className)}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}

/** The design's 46 px field: card ground, 1 px input rule, 3 px radius. */
export const inputClass =
  "h-[46px] w-full rounded-[3px] border border-input bg-card px-[14px] text-sm text-foreground placeholder:text-subtle-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 focus:outline-none disabled:bg-photo-tint disabled:text-subtle-foreground";

export function Input({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(inputClass, className)} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-[7px] block text-xs font-medium tracking-[0.2px] text-inverse"
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className="mt-[7px] text-xs leading-5 text-subtle-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-[640px]">
        <p className="font-mono text-[11px] font-medium tracking-[1.5px] text-primary uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-[14px] font-serif text-[30px] leading-[34px] font-semibold tracking-[-0.8px] sm:text-[38px] sm:leading-[42px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-[10px] text-[14px] leading-[22px] text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-[10px]">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "overflow-hidden rounded-md border border-border bg-card",
        className,
      )}
    >
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-[14px]">
          <div className="min-w-0">
            <h2 className="font-serif text-[19px] leading-6 font-semibold tracking-[-0.3px]">
              {title}
            </h2>
            {description ? (
              <p className="mt-[3px] text-xs leading-[18px] text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-start gap-3 rounded-md border border-dashed border-rule-mid px-5 py-6",
        className,
      )}
    >
      <div>
        <p className="font-serif text-[17px] font-semibold text-foreground">
          {title}
        </p>
        {body ? (
          <p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">
            {body}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Banner({
  tone,
  children,
  className,
}: {
  tone: "success" | "error" | "info";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    success:
      "border-positive-tint-strong bg-positive-tint text-positive-strong",
    error:
      "border-danger-tint-strong bg-danger-tint text-danger-strong",
    info: "border-border bg-secondary text-muted-foreground",
  } as const;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-[3px] border px-3 py-2 text-sm leading-6",
        tones[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx("animate-pulse rounded-[3px] bg-muted", className)}
    />
  );
}

/** A loading placeholder with a screen-reader announcement. */
export function SkeletonList({
  rows = 3,
  label = "Loading…",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div>
      <p className="sr-only">{label}</p>
      <ul aria-hidden="true" className="divide-y divide-border">
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className="flex flex-col gap-2 px-4 py-4 sm:px-5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-64 max-w-full" />
            <Skeleton className="h-3 w-24" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The page-level placeholder used while a Convex query is in flight. */
export function PageSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <div>
      <p className="sr-only">{label}</p>
      <div aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      </div>
    </div>
  );
}
