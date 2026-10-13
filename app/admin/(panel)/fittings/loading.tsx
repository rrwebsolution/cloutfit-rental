import { PageHeader } from "@/components/admin/page-header";
import { LoadingRegion, TableSkeleton, ToolbarSkeleton } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <PageHeader title="Fitting Appointments" description="Upcoming fittings that need attention. Use the filters to see past or cancelled ones." />
      <LoadingRegion label="fitting appointments">
        <ToolbarSkeleton filters={2} search={false} />
        <TableSkeleton columns={6} rows={6} />
      </LoadingRegion>
    </>
  );
}
