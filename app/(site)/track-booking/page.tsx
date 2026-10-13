import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { TrackFormSkeleton } from "@/components/site/skeletons";
import { TrackForm } from "@/components/site/track-form";

export const metadata: Metadata = {
  title: "Track Booking",
  description: "Check the status of your Cloutfit Rental booking with your reference and email or mobile number.",
};

export default function TrackBookingPage() {
  return (
    <div className="container-page max-w-xl py-12 md:py-16">
      <header className="text-center">
        <p className="eyebrow">Track Booking</p>
        <h1 className="mt-3 font-heading text-4xl sm:text-5xl">Where is my booking?</h1>
        <p className="mt-3 text-muted-foreground">
          Enter your booking reference and the email or mobile number you used to see your status,
          outfit, dates, fitting appointment and reservation fee.
        </p>
      </header>

      <div className="surface-card mt-8 p-6 sm:p-8">
        <Suspense fallback={<TrackFormSkeleton />}>
          <TrackForm />
        </Suspense>
      </div>

      <p className="mt-5 flex items-start justify-center gap-2 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
        For your privacy, we need both details to show a booking.
      </p>
    </div>
  );
}
