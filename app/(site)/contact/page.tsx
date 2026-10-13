import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/site/contact-form";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Cloutfit Rental — address, hours, phone and email.",
};

export default async function ContactPage() {
  const settings = await getSettings();
  const details = [
    { icon: MapPin, label: "Address", value: settings.business_address, href: undefined },
    { icon: Clock, label: "Hours", value: settings.business_hours, href: undefined },
    {
      icon: Phone,
      label: "Mobile",
      value: settings.business_mobile,
      href: `tel:${settings.business_mobile.replace(/\s/g, "")}`,
    },
    { icon: Mail, label: "Email", value: settings.business_email, href: `mailto:${settings.business_email}` },
  ].filter((d) => d.value);
  const socials = [
    { label: "Facebook", href: settings.social_facebook },
    { label: "Instagram", href: settings.social_instagram },
    { label: "TikTok", href: settings.social_tiktok },
  ].filter((s) => s.href);

  return (
    <div className="container-page py-10 md:py-14">
      <header className="max-w-2xl">
        <p className="eyebrow">Contact</p>
        <h1 className="mt-3 font-heading text-4xl sm:text-5xl">We&apos;re here to help</h1>
        <p className="mt-3 text-muted-foreground">
          Questions about sizing, availability or your booking? Send us a message or reach us directly.
        </p>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {details.map((d) => (
              <li key={d.label} className="surface-card flex gap-4 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                  <d.icon className="size-5" strokeWidth={1.5} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs tracking-[0.2em] text-muted-red uppercase">{d.label}</p>
                  {d.href ? (
                    <a href={d.href} className="mt-1 block font-medium break-words text-foreground hover:text-primary">
                      {d.value}
                    </a>
                  ) : (
                    <p className="mt-1 font-medium text-foreground">{d.value}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {socials.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="link-underline font-medium">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <section className="surface-card p-6 sm:p-8" aria-labelledby="message-heading">
          <h2 id="message-heading" className="font-heading text-2xl">
            Send us a message
          </h2>
          <div className="mt-5">
            <ContactForm />
          </div>
        </section>
      </div>
    </div>
  );
}
