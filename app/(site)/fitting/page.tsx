import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock, MapPin, Ruler } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { flattenParams } from "@/components/shared/pagination";
import { FittingForm } from "@/components/site/fitting-form";
import { getOutfits } from "@/lib/data/catalogue";
import { getSettings } from "@/lib/settings";
import { addDays, formatTime } from "@/lib/dates";
import { getShopToday } from "@/lib/today";
import { WEEKDAYS_SHORT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Book a Fitting",
  description: "Schedule a fitting appointment at Cloutfit Rental. Choose a date and an available time slot.",
};

export default async function FittingPage({ searchParams }: PageProps<"/fitting">) {
  const settings = await getSettings();
  const days = WEEKDAYS_SHORT.filter((_, i) => settings.fitting_days.includes(i)).join(", ");

  return (
    <div className="container-page py-10 md:py-14">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
        <header>
          <p className="eyebrow">Fitting Appointment</p>
          <h1 className="mt-3 font-heading text-4xl sm:text-5xl">Book a fitting</h1>
          <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
            Try on your outfit with our stylist before your event. Pick a date and an open time —
            we&apos;ll confirm by email.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
              <span>
                <span className="block font-medium text-foreground">Fitting hours</span>
                <span className="text-muted-foreground">
                  {days} · {formatTime(settings.fitting_open_time)} – {formatTime(settings.fitting_close_time)}
                </span>
              </span>
            </li>
            <li className="flex gap-3">
              <Ruler className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
              <span>
                <span className="block font-medium text-foreground">About {settings.fitting_duration_minutes} minutes</span>
                <span className="text-muted-foreground">Unhurried, one-on-one time with the outfit.</span>
              </span>
            </li>
            {settings.business_address ? (
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
                <span>
                  <span className="block font-medium text-foreground">Where</span>
                  <span className="text-muted-foreground">{settings.business_address}</span>
                </span>
              </li>
            ) : null}
          </ul>
        </header>

        <div className="surface-card p-5 sm:p-8">
          <Suspense fallback={<Skeleton className="h-[28rem] w-full" />}>
            <FormLoader searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function FormLoader({ searchParams }: Pick<PageProps<"/fitting">, "searchParams">) {
  const params = flattenParams(await searchParams);
  const [outfits, settings] = await Promise.all([getOutfits(), getSettings()]);
  const today = await getShopToday();
  const active = outfits.filter((o) => o.status === "active");

  return (
    <FittingForm
      outfits={active.map((o) => ({ id: o.id, name: o.name }))}
      today={today}
      maxDate={addDays(today, settings.booking_window_days)}
      initialOutfitId={active.find((o) => o.slug === params.outfit)?.id ?? ""}
      initialReference={/^CLT-\d{4}-\d{4,}$/i.test(params.reference ?? "") ? params.reference!.toUpperCase() : ""}
    />
  );
}
