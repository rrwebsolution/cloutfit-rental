import { PageHeader } from "@/components/admin/page-header";
import { FormSkeleton, LoadingRegion } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <PageHeader title="Settings" description="Business details and booking rules. Changes apply immediately — no code changes needed." />
      <LoadingRegion label="settings">
        <FormSkeleton sections={4} fields={4} />
      </LoadingRegion>
    </>
  );
}
