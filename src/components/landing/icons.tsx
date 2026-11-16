import type { SVGProps } from "react";

/**
 * The landing page's marks. Every one is inline SVG: the page ships no icon
 * font and no third-party script, and a tool row never uses a photograph.
 */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} satisfies SVGProps<SVGSVGElement>;

export function ChainMark({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 44 22"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      aria-hidden
      focusable={false}
      className={className}
    >
      <rect x="1.3" y="1.3" width="21" height="19.4" rx="9.7" />
      <rect x="21.7" y="1.3" width="21" height="19.4" rx="9.7" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="m16 16 5 5" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.2 19 6v5.1c0 4.6-3 7.7-7 9.2-4-1.5-7-4.6-7-9.2V6z" />
      <path d="m9 12 2 2 4-4.2" />
    </svg>
  );
}

export function CompassIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="m15.4 8.6-2 4.8-4.8 2 2-4.8z" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.6" y="5.4" width="16.8" height="15" rx="2.4" />
      <path d="M3.6 10h16.8M8.4 3.6v3.4M15.6 3.6v3.4" />
      <path d="M7.6 14h2M11 14h2M14.4 14h2M7.6 17.2h2M11 17.2h2" />
    </svg>
  );
}

export function ReturnIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.4 12a7.6 7.6 0 1 0 2.4-5.5" />
      <path d="M4.2 4.4v4.4h4.4" />
      <path d="M9.4 12h5.2l-2 2.6M14.6 12l-2-2.6" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} strokeWidth={2} className={className}>
      <path d="m5 12.6 4.4 4.2L19 6.8" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </svg>
  );
}

export function DrillIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.8 9.2h8.6v5.6H2.8z" />
      <path d="M11.4 10.4h3.2l6 1.6-6 1.6h-3.2" />
      <path d="M6 14.8v5" />
    </svg>
  );
}

export function LadderIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7.4 2.8v18.4M16.6 2.8v18.4M7.4 7.4h9.2M7.4 12h9.2M7.4 16.6h9.2" />
    </svg>
  );
}

export function LeafIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M20.4 3.6c0 8.4-5 12.8-11 12.8H4.6c0-8.4 5-12.8 11-12.8z" />
      <path d="M3.6 20.4c2.8-5.8 7-9.2 12.4-11.2" />
    </svg>
  );
}

export function TentIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.8 2.8 20.2h18.4z" />
      <path d="M12 3.8v16.4" />
      <path d="m8.4 20.2 3.6-6 3.6 6" />
    </svg>
  );
}

export function PotIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 9.4h16v7.4a3.2 3.2 0 0 1-3.2 3.2H7.2A3.2 3.2 0 0 1 4 16.8z" />
      <path d="M2.4 9.4h19.2" />
      <path d="M8.6 5.4c0-1 .8-1.8 1.8-1.8M12 4.6c0-.8.6-1.4 1.4-1.4" />
    </svg>
  );
}

export function PlugIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8.6 3v5M15.4 3v5" />
      <path d="M5.8 8h12.4v2.6a6.2 6.2 0 0 1-12.4 0z" />
      <path d="M12 16.8v4.2" />
    </svg>
  );
}

export function ToolboxIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 8.4h18v10.4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M8.6 8.4V5.6a1.6 1.6 0 0 1 1.6-1.6h3.6a1.6 1.6 0 0 1 1.6 1.6v2.8" />
      <path d="M3 13.2h18" />
    </svg>
  );
}

/**
 * A category is free text on a tool, so this mapping falls back to a generic
 * toolbox for anything the six known categories do not cover. It is only
 * decoration; the category is always printed next to it.
 */
export function CategoryIcon({
  category,
  className,
}: IconProps & { category: string }) {
  switch (category.trim().toLowerCase()) {
    case "power tools":
      return <DrillIcon className={className} />;
    case "ladders":
      return <LadderIcon className={className} />;
    case "garden":
      return <LeafIcon className={className} />;
    case "camping":
      return <TentIcon className={className} />;
    case "kitchen":
      return <PotIcon className={className} />;
    case "electronics":
      return <PlugIcon className={className} />;
    default:
      return <ToolboxIcon className={className} />;
  }
}
