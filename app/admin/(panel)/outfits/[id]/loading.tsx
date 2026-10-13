import { FormSkeleton, HeaderSkeleton, LoadingRegion, PhotoGridSkeleton } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <HeaderSkeleton back actions={2} />
      <LoadingRegion label="outfit">
        <div className="grid gap-6">
          <PhotoGridSkeleton />
          <FormSkeleton sections={3} fields={4} />
        </div>
      </LoadingRegion>
    </>
  );
}
