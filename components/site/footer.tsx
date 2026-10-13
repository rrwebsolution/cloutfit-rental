import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/constants";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { getSettings } from "@/lib/settings";

const LINKS = [
  {
    title: "Explore",
    items: [
      { href: "/catalogue", label: "Catalogue" },
      { href: "/#how-it-works", label: "How It Works" },
      { href: "/fitting", label: "Book a Fitting" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/track-booking", label: "Track Booking" },
      { href: "/rental-policies", label: "Rental Policies" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export async function SiteFooter() {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings);
  const settings = await getSettings();
  const year = new Date().getFullYear();
  const socials = [
    { label: "Facebook", href: settings.social_facebook },
    { label: "Instagram", href: settings.social_instagram },
    { label: "TikTok", href: settings.social_tiktok },
  ].filter((s) => s.href);

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div>
          <Logo name={settings.business_name} />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Curated occasion wear for rent. Browse the collection, reserve in advance, and find
            your perfect fit.
          </p>
          {socials.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="link-underline">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {LINKS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <p className="eyebrow mb-4">{group.title}</p>
            <ul className="space-y-2.5 text-sm">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-foreground/80 transition-colors hover:text-primary">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <p className="eyebrow mb-4">Visit Us</p>
          <ul className="space-y-3 text-sm text-foreground/80">
            {settings.business_address ? (
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>{settings.business_address}</span>
              </li>
            ) : null}
            {settings.business_hours ? (
              <li className="flex gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>{settings.business_hours}</span>
              </li>
            ) : null}
            {settings.business_mobile ? (
              <li className="flex gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <a href={`tel:${settings.business_mobile.replace(/\s/g, "")}`} className="hover:text-primary">
                  {settings.business_mobile}
                </a>
              </li>
            ) : null}
            {settings.business_email ? (
              <li className="flex gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <a href={`mailto:${settings.business_email}`} className="break-all hover:text-primary">
                  {settings.business_email}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {year} {settings.business_name}. All rights reserved.
          </p>
          <p className="tracking-[0.25em] uppercase">Elegant · Premium · Modern</p>
        </div>
      </div>
    </footer>
  );
}
