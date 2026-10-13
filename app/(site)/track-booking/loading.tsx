import { TrackFormSkeleton } from "@/components/site/skeletons";

export default function Loading() {
  return (
    <div className="container-page max-w-xl py-12 md:py-16">
      <header className="text-center">
        <p className="eyebrow">Track Booking</p>
        <h1 className="mt-3 font-heading text-4xl sm:text-5xl">Where is my booking?</h1>
      </header>
      <div className="surface-card mt-8 p-6 sm:p-8">
        <TrackFormSkeleton />
      </div>
    </div>
  );
}
