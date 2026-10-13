import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Server-rendered pagination. `hrefFor(page)` builds each link's URL. */
export function Pagination({
  page,
  pageCount,
  total,
  hrefFor,
  label = "results",
}: {
  page: number;
  pageCount: number;
  total: number;
  hrefFor: (page: number) => string;
  label?: string;
}) {
  if (pageCount <= 1) {
    return total > 0 ? (
      <p className="text-sm text-muted-foreground">
        {total} {label}
      </p>
    ) : null;
  }

  const link = (target: number, disabled: boolean, children: React.ReactNode, aria: string) =>
    disabled ? (
      <span
        aria-disabled
        className={cn(buttonVariants({ variant: "outline", size: "md" }), "pointer-events-none opacity-45")}
      >
        {children}
      </span>
    ) : (
      <Link
        href={hrefFor(target)}
        aria-label={aria}
        className={buttonVariants({ variant: "outline", size: "md" })}
      >
        {children}
      </Link>
    );

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Page {page} of {pageCount} · {total} {label}
      </p>
      <div className="flex gap-2">
        {link(
          page - 1,
          page <= 1,
          <>
            <ChevronLeft aria-hidden /> Previous
          </>,
          "Previous page",
        )}
        {link(
          page + 1,
          page >= pageCount,
          <>
            Next <ChevronRight aria-hidden />
          </>,
          "Next page",
        )}
      </div>
    </nav>
  );
}

/** Build a query string from the current params with some overridden. */
export function withParams(
  base: string,
  current: Record<string, string | undefined>,
  overrides: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...overrides })) {
    if (v !== undefined && v !== "" && !(k === "page" && String(v) === "1")) params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Normalise Next's searchParams (string | string[] | undefined) to strings. */
export function flattenParams(
  sp: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}
