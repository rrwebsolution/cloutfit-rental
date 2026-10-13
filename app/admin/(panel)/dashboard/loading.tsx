import { DashboardSkeleton, HeaderSkeleton, LoadingRegion } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <LoadingRegion label="dashboard">
        <DashboardSkeleton />
      </LoadingRegion>
    </>
  );
}
