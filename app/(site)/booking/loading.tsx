import { BookingWizardSkeleton } from "@/components/site/skeletons";

export default function Loading() {
  return (
    <div className="container-page py-10 md:py-14">
      <header className="mb-8 max-w-2xl">
        <p className="eyebrow">Reservation</p>
        <h1 className="mt-3 font-heading text-4xl sm:text-5xl">Reserve your outfit</h1>
      </header>
      <BookingWizardSkeleton />
    </div>
  );
}
