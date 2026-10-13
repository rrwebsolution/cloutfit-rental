"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ExternalLink, Plus, Search } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ADMIN_NAV } from "@/components/admin/nav";
import { startNavigationProgress } from "@/components/shared/navigation-progress";
import type { UserRole } from "@/lib/types";

const noopSubscribe = () => () => {};
/** True on Apple devices, where the shortcut is ⌘K instead of Ctrl K. */
function useIsMac() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

/**
 * Command palette for the admin area: Ctrl/⌘ + K (or the header button) opens
 * it; type to filter, ↑/↓ to move, Enter or click to jump, Esc to close.
 */
export function CommandMenu({ role }: { role: UserRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isMac = useIsMac();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Warm every admin page's shell (its skeleton) once the dashboard is idle.
  // Next.js only prefetches links that are on screen, so pages reached through
  // this menu, or sidebar items scrolled out of view, would otherwise have to
  // wait for the server before showing anything.
  useEffect(() => {
    const warm = () => {
      for (const group of ADMIN_NAV) {
        for (const item of group.items) {
          if (!item.adminOnly || role === "admin") router.prefetch(item.href);
        }
      }
    };
    const id = window.setTimeout(warm, 1200);
    return () => window.clearTimeout(id);
  }, [router, role]);

  const go = (href: string) => {
    setOpen(false);
    startNavigationProgress(href);
    router.push(href);
  };

  const groups = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || role === "admin"),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search or jump to a page"
        aria-keyshortcuts="Control+K Meta+K"
        className="flex h-9 w-9 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm text-muted-foreground transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-full sm:max-w-xs sm:justify-start sm:px-3"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden flex-1 text-left sm:inline">Search or jump to...</span>
        <kbd className="hidden rounded-md border border-border bg-background px-1.5 py-0.5 font-sans text-[0.7rem] font-medium text-muted-foreground sm:inline">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Quick Navigation"
        description="Search for a page and press Enter to open it."
        className="sm:max-w-lg"
      >
        <Command loop filter={matchCommand}>
          <CommandInput placeholder="Search or jump to..." />
          <CommandList className="max-h-[min(26rem,60vh)]">
            <CommandEmpty>No matching page.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.title} heading={group.title.toUpperCase()}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${group.title} ${item.label}`}
                    keywords={item.keywords?.split(" ")}
                    onSelect={() => go(item.href)}
                  >
                    <item.icon className="size-4 text-primary" aria-hidden />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandSeparator />
            <CommandGroup heading="ACTIONS">
              <CommandItem value="Actions Add outfit" keywords={["new", "create"]} onSelect={() => go("/admin/outfits/new")}>
                <Plus className="size-4 text-primary" aria-hidden />
                Add Outfit
              </CommandItem>
              <CommandItem
                value="Actions View public site"
                keywords={["website", "storefront", "customer"]}
                onSelect={() => {
                  setOpen(false);
                  window.open("/", "_blank", "noopener");
                }}
              >
                <ExternalLink className="size-4 text-primary" aria-hidden />
                View Public Site
              </CommandItem>
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-[0.7rem] text-muted-foreground">
            <span>
              <Key>↑</Key> <Key>↓</Key> to navigate
            </span>
            <span>
              <Key>Enter</Key> to open · <Key>Esc</Key> to close
            </span>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}

/**
 * Predictable matching instead of cmdk's fuzzy default (where "fitt" also hits
 * "Outfits"): every typed word must appear in the command's name, group or
 * keywords. Matches in the visible name rank above keyword-only matches.
 */
function matchCommand(value: string, search: string, keywords: string[] = []): number {
  const query = search.toLowerCase().trim();
  if (!query) return 1;
  const name = value.toLowerCase();
  const haystack = `${name} ${keywords.join(" ").toLowerCase()}`;
  if (!query.split(/\s+/).every((word) => haystack.includes(word))) return 0;
  return name.includes(query) ? 1 : 0.5;
}

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-border bg-background px-1 py-px font-sans">{children}</kbd>;
}
