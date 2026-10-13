import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarHeart,
  Clock,
  Gem,
  HandHeart,
  Mail,
  MapPin,
  MousePointerClick,
  Phone,
  Ruler,
  Search,
  ShieldCheck,
  Shirt,
  Sparkles,
  Undo2,
  Wallet,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { OutfitImage } from "@/components/shared/outfit-image";
import { OutfitCard } from "@/components/site/outfit-card";
import { getCategories, getOutfits } from "@/lib/data/catalogue";
import { getSettings } from "@/lib/settings";
import { formatPeso } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: Search, title: "Browse", text: "Explore the collection by occasion, size and colour." },
  { icon: MousePointerClick, title: "Choose", text: "Pick the outfit and the dates you need it." },
  { icon: CalendarCheck, title: "Reserve", text: "Hold it with a small reservation fee." },
  { icon: Ruler, title: "Fit", text: "Visit us for a fitting so it sits just right." },
  { icon: Shirt, title: "Rent", text: "Claim your outfit and enjoy your event." },
  { icon: Undo2, title: "Return", text: "Bring it back — we handle the cleaning." },
];

const REASONS = [
  { icon: Gem, title: "Curated pieces", text: "Every outfit is hand-picked, cared for and event-ready." },
  { icon: CalendarHeart, title: "Reserve in advance", text: "See real availability by date and lock in your look early." },
  { icon: HandHeart, title: "Personal fittings", text: "One-on-one appointments, so you walk in confident." },
  { icon: Wallet, title: "Luxury for less", text: "Wear something remarkable without the price of owning it." },
  { icon: ShieldCheck, title: "Clear policies", text: "Simple terms, no surprises, and friendly support." },
  { icon: Sparkles, title: "Fresh every time", text: "Professionally cleaned and inspected before each rental." },
];

export default async function HomePage() {
  const [settings, outfits, categories] = await Promise.all([
    getSettings(),
    getOutfits(),
    getCategories(),
  ]);

  const active = outfits.filter((o) => o.status === "active");
  const featured = (active.some((o) => o.is_featured) ? active.filter((o) => o.is_featured) : active).slice(0, 4);
  const featuredIds = new Set(featured.map((o) => o.id));
  const arrivals = active.filter((o) => !featuredIds.has(o.id)).slice(0, 4);
  const hero = featured[0] ?? null;
  const countByCategory = new Map<string, number>();
  for (const o of active) countByCategory.set(o.category_id, (countByCategory.get(o.category_id) ?? 0) + 1);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-40 size-[34rem] rounded-full bg-surface opacity-70 blur-3xl"
        />
        <div className="container-page relative grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="animate-fade-up">
            <p className="eyebrow">Outfit Rental · Reservations · Fittings</p>
            <h1 className="mt-5 font-heading text-5xl leading-[1.05] font-medium tracking-tight text-primary-dark sm:text-6xl lg:text-7xl">
              Find Your <em className="text-primary">Perfect</em> Look
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-foreground/80 sm:text-lg">
              Browse our curated collection of gowns, suits and occasion wear. Reserve your outfit
              in advance for the dates you need, and schedule a fitting appointment so everything
              is just right on the day.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/catalogue" className={buttonVariants({ size: "xl" })}>
                Browse Collection <ArrowRight aria-hidden />
              </Link>
              <Link href="/fitting" className={buttonVariants({ size: "xl", variant: "outline", className: "border-primary/40 text-primary" })}>
                Book a Fitting
              </Link>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-7">
              {[
                [active.length > 0 ? `${active.length}+` : "New", "Outfits"],
                [formatPeso(settings.reservation_fee), "To reserve"],
                [`${settings.max_rental_days} days`, "Max rental"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="font-heading text-2xl text-primary">{value}</dd>
                  <dd className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md animate-fade-up [animation-delay:150ms]">
            <div aria-hidden className="absolute -inset-3 rounded-t-full rounded-b-3xl border border-primary/25" />
            <OutfitImage
              src={hero?.images[0]?.url}
              alt={hero ? hero.name : "An elegant evening outfit from the Cloutfit collection"}
              priority
              sizes="(max-width: 1024px) 90vw, 40vw"
              className="aspect-[4/5] rounded-t-full rounded-b-3xl border border-border shadow-lift"
            />
            {hero ? (
              <Link
                href={`/outfits/${hero.slug}`}
                className="surface-card absolute -bottom-5 left-4 flex items-center gap-3 px-4 py-3 transition-transform hover:-translate-y-0.5 sm:-left-6"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Sparkles className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-[0.65rem] tracking-[0.2em] text-muted-red uppercase">Featured</span>
                  <span className="block font-heading text-sm text-primary-dark">{hero.name}</span>
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 ? (
        <section className="container-page py-16 md:py-20" aria-labelledby="featured-heading">
          <SectionHeading
            id="featured-heading"
            eyebrow="Featured Collection"
            title="Pieces our clients love"
            action={{ href: "/catalogue", label: "View all outfits" }}
          />
          <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((outfit) => (
              <OutfitCard key={outfit.id} outfit={outfit} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Categories */}
      {categories.length > 0 ? (
        <section className="border-y border-border bg-surface py-16 md:py-20" aria-labelledby="categories-heading">
          <div className="container-page">
            <SectionHeading id="categories-heading" eyebrow="Categories" title="Dress for the occasion" center />
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category, i) => (
                <li key={category.id}>
                  <Link
                    href={`/catalogue?category=${category.slug}`}
                    className="group flex h-full items-start justify-between gap-4 rounded-2xl border border-border bg-background/60 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
                  >
                    <div>
                      <p className="font-heading text-sm text-muted-red">{String(i + 1).padStart(2, "0")}</p>
                      <h3 className="mt-2 font-heading text-xl">{category.name}</h3>
                      {category.description ? (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{category.description}</p>
                      ) : null}
                      <p className="mt-3 text-xs tracking-wide text-primary uppercase">
                        {countByCategory.get(category.id) ?? 0} outfits
                      </p>
                    </div>
                    <ArrowRight className="mt-1 size-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* New arrivals */}
      {arrivals.length > 0 ? (
        <section className="container-page py-16 md:py-20" aria-labelledby="arrivals-heading">
          <SectionHeading
            id="arrivals-heading"
            eyebrow="New Arrivals"
            title="Fresh on the rack"
            action={{ href: "/catalogue?sort=newest", label: "See what's new" }}
          />
          <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {arrivals.map((outfit) => (
              <OutfitCard key={outfit.id} outfit={outfit} />
            ))}
          </div>
        </section>
      ) : null}

      {/* How it works */}
      <section
        id="how-it-works"
        className="scroll-mt-20 border-y border-border bg-surface py-16 md:py-20"
        aria-labelledby="how-heading"
      >
        <div className="container-page">
          <SectionHeading
            id="how-heading"
            eyebrow="How It Works"
            title="From browsing to the big day"
            description="Six simple steps. No guesswork, no last-minute stress."
            center
          />
          <ol className="mt-12 grid gap-y-10 sm:grid-cols-2 lg:grid-cols-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex flex-col items-center px-3 text-center">
                {i < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute top-7 left-[calc(50%+2.25rem)] hidden h-px w-[calc(100%-4.5rem)] bg-gradient-to-r from-primary/40 to-primary/10 lg:block"
                  />
                ) : null}
                <span className="relative flex size-14 items-center justify-center rounded-full border border-primary/25 bg-background text-primary">
                  <step.icon className="size-6" strokeWidth={1.5} aria-hidden />
                  <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[0.65rem] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-4 font-heading text-lg">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why choose */}
      <section className="container-page py-16 md:py-20" aria-labelledby="why-heading">
        <SectionHeading id="why-heading" eyebrow="Why Choose Cloutfit" title="Made to feel effortless" />
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {REASONS.map((reason) => (
            <li key={reason.title} className="surface-card p-6 transition-shadow duration-300 hover:shadow-lift">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
                <reason.icon className="size-5" strokeWidth={1.5} aria-hidden />
              </span>
              <h3 className="mt-4 font-heading text-lg">{reason.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{reason.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Fitting CTA */}
      <section className="container-page pb-16 md:pb-20" aria-labelledby="cta-heading">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground shadow-lift sm:px-12 md:py-16">
          <div aria-hidden className="absolute -top-24 -left-24 size-64 rounded-full border border-primary-foreground/15" />
          <div aria-hidden className="absolute -right-16 -bottom-28 size-80 rounded-full border border-primary-foreground/15" />
          <p className="text-xs font-semibold tracking-[0.28em] text-primary-foreground/80 uppercase">Book Your Fitting</p>
          <h2 id="cta-heading" className="mx-auto mt-4 max-w-2xl font-heading text-3xl leading-tight text-primary-foreground sm:text-4xl">
            See it, try it, love it — before your event
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">
            Reserve a private fitting appointment and let us help you find the look that feels like you.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/fitting"
              className={cn(buttonVariants({ size: "xl" }), "bg-surface text-primary hover:bg-background")}
            >
              Book a Fitting
            </Link>
            <Link
              href="/catalogue"
              className={cn(
                buttonVariants({ size: "xl", variant: "outline" }),
                "border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
              )}
            >
              Browse Collection
            </Link>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="border-t border-border bg-surface py-16" aria-labelledby="contact-heading">
        <div className="container-page grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow">Contact</p>
            <h2 id="contact-heading" className="section-title mt-3">
              We&apos;d love to dress you
            </h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Questions about an outfit, sizing or your booking? Reach out — we&apos;re happy to help.
            </p>
            <Link href="/contact" className={buttonVariants({ size: "xl", className: "mt-7" })}>
              Get in Touch
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: MapPin, label: "Address", value: settings.business_address },
              { icon: Clock, label: "Hours", value: settings.business_hours },
              { icon: Phone, label: "Mobile", value: settings.business_mobile },
              { icon: Mail, label: "Email", value: settings.business_email },
            ]
              .filter((item) => item.value)
              .map((item) => (
                <li key={item.label} className="rounded-2xl border border-border bg-background/60 p-5">
                  <item.icon className="size-5 text-primary" strokeWidth={1.5} aria-hidden />
                  <p className="mt-3 text-xs tracking-[0.2em] text-muted-red uppercase">{item.label}</p>
                  <p className="mt-1 text-sm font-medium break-words text-foreground">{item.value}</p>
                </li>
              ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
  center = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  center?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", center && "flex-col items-center text-center")}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="section-title mt-3">
          {title}
        </h2>
        {description ? <p className="mt-3 max-w-xl text-muted-foreground">{description}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="link-underline inline-flex items-center gap-1.5 text-sm font-medium">
          {action.label} <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
