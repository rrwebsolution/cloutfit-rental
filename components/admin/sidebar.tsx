"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ExternalLink, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CommandMenu } from "@/components/admin/command-menu";
import { ADMIN_NAV } from "@/components/admin/nav";
import { Logo } from "@/components/shared/logo";
import { signOut } from "@/lib/actions/auth";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Staff } from "@/lib/auth";

/**
 * A link is active when its path matches (including nested routes such as
 * /admin/bookings/[id]) and its own query, if any, is present.
 */
function useIsActive() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (href: string) => {
    const [path, query] = href.split("?");
    if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
    if (query) {
      const [key, value] = query.split("=");
      return searchParams.get(key) === value;
    }
    // "Bookings" must not light up while its filtered sibling is showing.
    const siblingKey = path === "/admin/bookings" ? "view" : path === "/admin/payments" ? "type" : null;
    return siblingKey ? !searchParams.get(siblingKey) : true;
  };
}

function NavList({ staff, onNavigate }: { staff: Staff; onNavigate?: () => void }) {
  const isActive = useIsActive();
  return (
    <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {ADMIN_NAV.map((group, i) => {
        const items = group.items.filter((item) => !item.adminOnly || staff.role === "admin");
        if (items.length === 0) return null;
        return (
          <div key={group.title}>
            {/* The first group (Dashboard) needs no heading in the sidebar. */}
            {i > 0 ? (
              <p className="mb-1.5 px-3 text-[0.65rem] font-semibold tracking-[0.22em] text-muted-red uppercase">
                {group.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-foreground/80 hover:bg-accent hover:text-primary-dark active:bg-accent",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function UserPanel({ staff }: { staff: Staff }) {
  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-3 px-2 py-1.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials(staff.full_name || staff.email)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{staff.full_name || staff.email}</p>
          <p className="text-xs text-muted-foreground capitalize">{staff.role}</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link
          href="/"
          target="_blank"
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-medium hover:bg-muted"
        >
          <ExternalLink className="size-3.5" aria-hidden /> View site
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="h-9 w-full text-xs">
            <LogOut aria-hidden /> Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}

/**
 * Persistent admin chrome: fixed sidebar (desktop), slide-in sidebar (small
 * screens), and the top header with the command search. It lives in the
 * shared layout, so it stays mounted while only the page content changes.
 */
export function AdminSidebar({ staff, businessName }: { staff: Staff; businessName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center border-b border-border px-6">
          <Logo name={businessName} href="/admin/dashboard" compact />
        </div>
        <NavList staff={staff} />
        <UserPanel staff={staff} />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6 lg:ml-64 lg:px-8">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="-ml-2 lg:hidden"
          aria-label="Open admin menu"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
        <Logo name={businessName} href="/admin/dashboard" compact className="lg:hidden" />
        <div className="flex flex-1 justify-end lg:justify-start">
          <CommandMenu role={staff.role} />
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[84%] max-w-xs gap-0 bg-sidebar p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="font-heading text-lg text-primary">{businessName}</SheetTitle>
            <SheetDescription>Admin dashboard</SheetDescription>
          </SheetHeader>
          <NavList staff={staff} onNavigate={() => setOpen(false)} />
          <UserPanel staff={staff} />
        </SheetContent>
      </Sheet>
    </>
  );
}
