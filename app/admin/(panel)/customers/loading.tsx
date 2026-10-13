import { PageHeader } from "@/components/admin/page-header";
import { LoadingRegion, TableSkeleton, ToolbarSkeleton } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <PageHeader title="Customer Records" description="Everyone who has reserved an outfit or requested a fitting." />
      <LoadingRegion label="customers">
        <ToolbarSkeleton filters={0} />
        <TableSkeleton columns={7} />
      </LoadingRegion>
    </>
  );
}
