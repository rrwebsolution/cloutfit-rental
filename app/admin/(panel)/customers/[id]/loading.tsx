import { DetailSkeleton, HeaderSkeleton, LoadingRegion } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <HeaderSkeleton back />
      <LoadingRegion label="customer">
        <DetailSkeleton stats={3} />
      </LoadingRegion>
    </>
  );
}
