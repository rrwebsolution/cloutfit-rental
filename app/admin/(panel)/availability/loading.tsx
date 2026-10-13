import { PageHeader } from "@/components/admin/page-header";
import { LoadingRegion, PanelSkeleton, TableSkeleton } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <PageHeader title="Availability" description="Availability follows bookings automatically. Block dates here for holidays, cleaning or repairs." />
      <LoadingRegion label="availability">
        <div className="grid gap-6">
          <PanelSkeleton rows={2} />
          <TableSkeleton columns={8} rows={6} />
        </div>
      </LoadingRegion>
    </>
  );
}
