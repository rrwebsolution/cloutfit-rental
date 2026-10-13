import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { LoadingRegion, TableSkeleton } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <PageHeader title="Users" description="Staff accounts that can sign in to this dashboard.">
        <Skeleton className="h-10 w-32 rounded-lg" />
      </PageHeader>
      <LoadingRegion label="users">
        <TableSkeleton columns={5} rows={4} />
      </LoadingRegion>
    </>
  );
}
