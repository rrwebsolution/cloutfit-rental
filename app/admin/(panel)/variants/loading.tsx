import { PageHeader } from "@/components/admin/page-header";
import { LoadingRegion, TableSkeleton, ToolbarSkeleton } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <PageHeader title="Sizes / Variants" description="Every size and color you stock. Adjust quantities or hide a variant; add new ones from the outfit's page." />
      <LoadingRegion label="variants">
        <ToolbarSkeleton filters={0} />
        <TableSkeleton columns={4} rows={10} />
      </LoadingRegion>
    </>
  );
}
