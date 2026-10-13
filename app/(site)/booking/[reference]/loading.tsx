import { BookingViewSkeleton } from "@/components/site/skeletons";

export default function Loading() {
  return (
    <div className="container-page max-w-3xl py-10 md:py-14">
      <BookingViewSkeleton />
    </div>
  );
}
