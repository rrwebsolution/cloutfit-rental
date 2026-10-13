import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { LoadingRegion, TableSkeleton } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <PageHeader title="Categories" description="Group outfits by occasion or type.">
        <Skeleton className="h-10 w-32 rounded-lg" />
      </PageHeader>
      <LoadingRegion label="categories">
        <TableSkeleton columns={5} rows={6} />
      </LoadingRegion>
    </>
  );
}
