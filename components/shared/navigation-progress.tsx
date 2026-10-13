"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const EVENT = "cloutfit:navigation-start";

const currentKey = () => `${window.location.pathname}${window.location.search}`;

/**
 * Call right before a programmatic `router.push(href)` so the progress bar
 * also covers navigations that do not start from a link click.
 */
export function startNavigationProgress(href?: string) {
  if (typeof window === "undefined") return;
  if (href) {
    const target = new URL(href, window.location.href);
    if (`${target.pathname}${target.search}` === currentKey()) return;
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Thin burgundy bar at the top of the page while a route change is in flight.
 * It gives every click an immediate acknowledgement, and stays invisible for
 * navigations that complete within ~150 ms (no flicker on instant pages).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const here = `${pathname}${searchParams.size ? `?${searchParams}` : ""}`;
  // The URL the navigation started FROM. The bar shows only while we are still
  // on that URL, so it hides itself as soon as the route changes.
  const [startedFrom, setStartedFrom] = useState<string | null>(null);

  useEffect(() => {
    let failsafe: ReturnType<typeof setTimeout>;
    const start = () => {
      setStartedFrom(currentKey());
      clearTimeout(failsafe);
      failsafe = setTimeout(() => setStartedFrom(null), 12_000);
    };

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (or only the #hash differs): nothing to wait for.
      if (`${url.pathname}${url.search}` === currentKey()) return;
      start();
    };

    document.addEventListener("click", onClick);
    window.addEventListener(EVENT, start);
    return () => {
      clearTimeout(failsafe);
      document.removeEventListener("click", onClick);
      window.removeEventListener(EVENT, start);
    };
  }, []);

  if (startedFrom === null || startedFrom !== here) return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      aria-busy="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden"
    >
      <div className="nav-progress-bar h-full w-full origin-left bg-primary shadow-[0_0_10px_var(--primary)]" />
    </div>
  );
}
