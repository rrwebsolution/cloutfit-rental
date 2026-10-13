import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { LoadingRegion, TableSkeleton, ToolbarSkeleton } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <PageHeader title="Outfits" description="Your rental catalogue. Archived outfits keep their booking history.">
        <Skeleton className="h-10 w-32 rounded-lg" />
      </PageHeader>
      <LoadingRegion label="outfits">
        <ToolbarSkeleton filters={2} />
        <TableSkeleton columns={6} withThumbnail />
      </LoadingRegion>
    </>
  );
}
