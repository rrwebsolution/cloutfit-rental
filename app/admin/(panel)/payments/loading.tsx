import { HeaderSkeleton, LoadingRegion, StatCardsSkeleton, TableSkeleton, ToolbarSkeleton } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <LoadingRegion label="payments">
        <StatCardsSkeleton count={3} className="mb-5 sm:grid-cols-3 xl:grid-cols-3" />
        <ToolbarSkeleton filters={2} />
        <TableSkeleton columns={9} />
      </LoadingRegion>
    </>
  );
}
