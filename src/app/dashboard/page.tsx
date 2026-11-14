import { OverviewScreen } from "@/components/dashboard/OverviewScreen";

/**
 * The dashboard reads its data in the browser from Convex, so the page shell is
 * server-rendered but the segment opts out of instant-navigation validation:
 * a signed-in visit is expected to block while the Convex subscription starts.
 */
export const instant = false;

export default function DashboardPage() {
  return <OverviewScreen />;
}
