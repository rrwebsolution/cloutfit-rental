import { PageHeader } from "@/components/admin/page-header";
import { LoadingRegion, TableSkeleton } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <PageHeader title="Active Rentals" description="Outfits currently out with customers, sorted by return date." />
      <LoadingRegion label="active rentals">
        <TableSkeleton columns={8} rows={6} />
      </LoadingRegion>
    </>
  );
}
