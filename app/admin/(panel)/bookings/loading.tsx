import { HeaderSkeleton, LoadingRegion, TableSkeleton, ToolbarSkeleton } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <LoadingRegion label="bookings">
        <ToolbarSkeleton filters={1} />
        <TableSkeleton columns={8} />
      </LoadingRegion>
    </>
  );
}
