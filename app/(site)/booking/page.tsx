import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Shirt } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BookingWizardSkeleton } from "@/components/site/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { flattenParams } from "@/components/shared/pagination";
import { BookingWizard } from "@/components/site/booking-wizard";
import { getAvailability, getOutfitBySlug } from "@/lib/data/catalogue";
import { getPaymentMethods } from "@/lib/data/payment-methods";
import { getSettings } from "@/lib/settings";
import { addDays, addMonths, endOfMonth, isISODate } from "@/lib/dates";
import { getShopToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Reserve an Outfit",
  description: "Reserve your outfit, choose your rental dates and book a fitting appointment.",
  robots: { index: false },
};

export default function BookingPage({ searchParams }: PageProps<"/booking">) {
  return (
    <div className="container-page py-10 md:py-14">
      <header className="mb-8 max-w-2xl">
        <p className="eyebrow">Reservation</p>
        <h1 className="mt-3 font-heading text-4xl sm:text-5xl">Reserve your outfit</h1>
      </header>
      <Suspense fallback={<BookingWizardSkeleton />}>
        <BookingContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BookingContent({ searchParams }: Pick<PageProps<"/booking">, "searchParams">) {
  const params = flattenParams(await searchParams);
  const [outfit, settings, methods] = await Promise.all([
    params.outfit ? getOutfitBySlug(params.outfit) : null,
    getSettings(),
    getPaymentMethods(),
  ]);

  if (!outfit || outfit.status !== "active" || outfit.variants.length === 0) {
    return (
      <EmptyState
        icon={Shirt}
        title={outfit ? "This outfit is not available for booking" : "Choose an outfit to reserve"}
        description="Browse the collection, pick the look you love, then tap Reserve This Outfit."
      >
        <Link href="/catalogue" className={buttonVariants({ size: "xl" })}>
          Browse Collection
        </Link>
      </EmptyState>
    );
  }

  const today = await getShopToday();
  const loadedTo = endOfMonth(`${addMonths(today.slice(0, 7), 2)}-01`);
  const ranges = await getAvailability(today, loadedTo, outfit.id);
  const from = isISODate(params.from) && params.from >= today ? params.from : null;
  const to = from && isISODate(params.to) && params.to >= from ? params.to : null;

  return (
    <BookingWizard
      outfit={outfit}
      initialVariantId={outfit.variants.find((v) => v.id === params.variant)?.id ?? null}
      initialRange={{ from: to ? from : null, to }}
      initialRanges={ranges}
      today={today}
      loadedTo={loadedTo}
      maxDate={addDays(today, settings.booking_window_days)}
      maxRentalDays={settings.max_rental_days}
      payment={{
        fee: settings.reservation_fee,
        methods,
        instructions: settings.payment_instructions,
      }}
    />
  );
}
