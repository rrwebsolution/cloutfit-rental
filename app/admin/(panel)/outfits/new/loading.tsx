import { PageHeader } from "@/components/admin/page-header";
import { FormSkeleton, LoadingRegion } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <PageHeader title="Add Outfit" description="Save the details first — you can upload photos right after." back={{ href: "/admin/outfits", label: "All outfits" }} />
      <LoadingRegion label="outfit form">
        <FormSkeleton sections={3} fields={4} />
      </LoadingRegion>
    </>
  );
}
