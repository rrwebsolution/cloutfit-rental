import { Suspense } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ActiveDesktopNav, DesktopNav, MobileNav } from "@/components/site/nav-links";
import { getSettings } from "@/lib/settings";

export async function SiteHeader() {
  const settings = await getSettings();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="container-page flex h-[4.5rem] items-center justify-between gap-6">
        <Logo name={settings.business_name} />
        {/* usePathname needs a boundary on routes with dynamic params. */}
        <Suspense fallback={<DesktopNav pathname={null} />}>
          <ActiveDesktopNav />
        </Suspense>
        <div className="flex items-center gap-2">
          <Link href="/catalogue" className={buttonVariants({ size: "md", className: "hidden rounded-full px-5 sm:inline-flex" })}>
            Browse Collection
          </Link>
          <MobileNav businessName={settings.business_name} />
        </div>
      </div>
    </header>
  );
}
