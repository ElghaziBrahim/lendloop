/**
 * The LendLoop mark: two interlocking rings, the lend and the loop.
 *
 * Drawn in a 24-unit box with a 2-unit stroke so it holds up at 16 px. The
 * left ring inherits the surrounding text colour; the right ring uses the
 * primary token, so one asset works in both themes and on the dark footer.
 * A small gap in the rust ring at the upper crossing lets the dark ring show
 * through and reads as an interlock rather than two overlapping circles.
 */
const RADIUS = 6.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// The dash gap is 5.4 units; the round caps take 1 unit back at each end, so
// roughly 3.4 units of clear space remain at 24 units and about 2.3 px at 16.
const GAP = 5.4;
const DASH = `${(CIRCUMFERENCE - GAP).toFixed(3)} ${GAP}`;
// Put the gap on the upper crossing, where the two rings meet at (12, 6.23).
// The circle path starts at 3 o'clock and runs clockwise.
const GAP_OFFSET = "10.651";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle
        cx="9"
        cy="12"
        r={RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <circle
        cx="15"
        cy="12"
        r={RADIUS}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={DASH}
        strokeDashoffset={GAP_OFFSET}
        style={{ stroke: "var(--primary)" }}
      />
    </svg>
  );
}
