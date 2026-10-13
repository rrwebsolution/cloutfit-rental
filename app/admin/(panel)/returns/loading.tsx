import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { LoadingRegion, TableSkeleton } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <PageHeader title="Returns" description="Outfits due back within 7 days." />
      <LoadingRegion label="returns">
        <Skeleton className="mb-3 h-6 w-40" />
        <TableSkeleton columns={8} rows={4} />
        <Skeleton className="mt-10 mb-3 h-6 w-64" />
        <TableSkeleton columns={8} rows={3} />
      </LoadingRegion>
    </>
  );
}
