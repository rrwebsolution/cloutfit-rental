"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PUBLIC_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

function isActive(pathname: string | null, href: string) {
  if (pathname === null || href.includes("#")) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Desktop navigation. `pathname` is null in the Suspense fallback (rendered
 * before the URL is known), where no link is marked active.
 */
export function DesktopNav({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
      {PUBLIC_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-primary",
              "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 hover:after:scale-x-100",
              active && "text-primary after:scale-x-100",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ActiveDesktopNav() {
  return <DesktopNav pathname={usePathname()} />;
}

export function MobileNav({ businessName }: { businessName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="lg:hidden"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[86%] max-w-sm bg-surface">
          <SheetHeader className="border-b border-border pb-4">
            <SheetTitle className="font-heading text-xl text-primary">{businessName}</SheetTitle>
            <SheetDescription>Elegant outfit rentals</SheetDescription>
          </SheetHeader>
          <nav aria-label="Mobile" className="flex flex-col px-4">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-border/60 py-3.5 text-base font-medium text-foreground transition-colors hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto p-4">
            <Link
              href="/catalogue"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ size: "xl" }), "w-full")}
            >
              Browse Collection
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
