import { Suspense } from "react";
import { RequestsScreen } from "@/components/dashboard/RequestsScreen";
import { PageSkeleton } from "@/components/ui";

export const instant = false;

/**
 * `RequestsScreen` reads `?tool=` so a "Request dates" link from the shelf can
 * preselect the tool. That makes it a client component reading a request value,
 * hence the Suspense boundary.
 */
export default function RequestsPage() {
  return (
    <Suspense fallback={<PageSkeleton label="Loading your requests…" />}>
      <RequestsScreen />
    </Suspense>
  );
}
