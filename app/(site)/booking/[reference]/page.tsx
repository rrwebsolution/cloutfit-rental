import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BookingViewSkeleton } from "@/components/site/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { flattenParams } from "@/components/shared/pagination";
import { BookingView } from "@/components/site/booking-view";
import { buildCustomerView, findBookingByToken } from "@/lib/data/customer-booking";
import { getPaymentMethods } from "@/lib/data/payment-methods";
import { getSettings } from "@/lib/settings";
import { getShopToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Your Booking",
  robots: { index: false, follow: false },
  // The URL carries a private access token: never leak it to other sites.
  referrer: "no-referrer",
};

type Props = PageProps<"/booking/[reference]">;

export default function BookingConfirmationPage(props: Props) {
  return (
    <div className="container-page max-w-3xl py-10 md:py-14">
      <Suspense fallback={<BookingViewSkeleton />}>
        <Content {...props} />
      </Suspense>
    </div>
  );
}

async function Content({ params, searchParams }: Props) {
  const [{ reference }, sp] = await Promise.all([params, searchParams]);
  const query = flattenParams(sp);
  // The reference alone is guessable (CLT-2026-0001…), so it never unlocks a
  // booking. The unguessable token from the confirmation link is required.
  const booking = await findBookingByToken(reference, query.token ?? "");

  if (!booking) {
    return (
      <EmptyState
        icon={LockKeyhole}
        title="Verify to view this booking"
        description="For your privacy, booking details are only shown through your private link, or after you verify your email or mobile number."
      >
        <Link href={`/track-booking?reference=${encodeURIComponent(reference)}`} className={buttonVariants({ size: "xl" })}>
          Track My Booking
        </Link>
      </EmptyState>
    );
  }

  const [view, settings, methods] = await Promise.all([
    buildCustomerView(booking),
    getSettings(),
    getPaymentMethods(),
  ]);
  const isNew = query.new === "1";

  return (
    <>
      <header className="mb-8">
        {isNew ? (
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
        ) : null}
        <p className="eyebrow">{isNew ? "Reservation received" : "Your booking"}</p>
        <h1 className="mt-3 font-heading text-4xl sm:text-5xl">
          {isNew ? `Thank you, ${view.customer_name.split(" ")[0]}!` : "Booking summary"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {isNew
            ? `We emailed a confirmation to ${view.customer_email}. Save your booking reference — you can use it to track your booking any time.`
            : "Here is the latest on your reservation."}
        </p>
      </header>

      <BookingView
        booking={view}
        today={await getShopToday()}
        payment={{
          fee: view.reservation_fee,
          methods,
          instructions: settings.payment_instructions,
        }}
      />

      <section className="mt-6 rounded-2xl border border-border bg-surface/70 p-5 text-sm" aria-label="Your contact details">
        <p className="font-medium text-foreground">Booked by</p>
        <p className="mt-1 text-muted-foreground">
          {view.customer_name} · {view.customer_mobile} · {view.customer_email}
        </p>
        {view.customer_address ? <p className="text-muted-foreground">{view.customer_address}</p> : null}
        {view.notes ? <p className="mt-2 text-muted-foreground">Notes: {view.notes}</p> : null}
      </section>
    </>
  );
}
