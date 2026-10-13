import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Skeletons for the admin area. Each one mirrors the layout of the page it
// stands in for, so content replaces it without the page jumping around.

/** Wrapper that announces "loading" once for the whole placeholder. */
export function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={`Loading ${label}`}>
      {children}
      <span className="sr-only">Loading {label}…</span>
    </div>
  );
}

/** For detail pages whose title comes from the data (e.g. a booking reference). */
export function HeaderSkeleton({ back = false, actions = 0 }: { back?: boolean; actions?: number }) {
  return (
    <div className="mb-6">
      {back ? <Skeleton className="mb-3 h-4 w-28" /> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        {actions > 0 ? (
          <div className="flex gap-2">
            {Array.from({ length: actions }, (_, i) => (
              <Skeleton key={i} className="h-10 w-28 rounded-lg" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ToolbarSkeleton({ filters = 1, search = true }: { filters?: number; search?: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {search ? <Skeleton className="h-10 min-w-52 flex-1 rounded-lg sm:max-w-xs" /> : null}
      {Array.from({ length: filters }, (_, i) => (
        <Skeleton key={i} className="h-10 w-36 rounded-lg" />
      ))}
      {search ? <Skeleton className="h-10 w-24 rounded-lg" /> : null}
    </div>
  );
}

const WIDTHS = ["w-24", "w-32", "w-20", "w-28", "w-16", "w-36", "w-24", "w-20"];

/** Table placeholder: header row + `rows` body rows, `columns` cells each. */
export function TableSkeleton({
  columns = 6,
  rows = 8,
  withThumbnail = false,
}: {
  columns?: number;
  rows?: number;
  withThumbnail?: boolean;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-6 border-b border-border bg-muted/40 px-5 py-3.5">
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} className={cn("h-3.5", WIDTHS[(c + 3) % WIDTHS.length], c > 3 && "hidden md:block", c > 1 && c <= 3 && "hidden sm:block")} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-border px-5 py-4 last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            <div key={c} className={cn("flex items-center gap-3", c > 3 && "hidden md:flex", c > 1 && c <= 3 && "hidden sm:flex")}>
              {withThumbnail && c === 0 ? <Skeleton className="h-14 w-11 shrink-0 rounded-lg" /> : null}
              <Skeleton className={cn("h-4", WIDTHS[(r + c) % WIDTHS.length])} />
            </div>
          ))}
          <Skeleton className="ml-auto h-8 w-16 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function StatCardsSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="surface-card p-5">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="size-9 rounded-xl" />
          </div>
          <Skeleton className="mt-3 h-8 w-16" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Titled card with a list of rows, like the dashboard panels. */
export function PanelSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("surface-card min-w-0", className)}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-14" />
      </div>
      <div className="divide-y divide-border px-5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-3.5">
            <div className="min-w-0 flex-1">
              <Skeleton className={cn("h-4", i % 2 ? "w-44" : "w-56", "max-w-full")} />
              <Skeleton className="mt-2 h-3 w-36 max-w-full" />
            </div>
            <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CalendarSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={`h-${i}`} className="flex justify-center bg-muted/60 py-2.5">
          <Skeleton className="h-3 w-6" />
        </div>
      ))}
      {Array.from({ length: 35 }, (_, i) => (
        <div key={i} className={cn("bg-card p-1.5", compact ? "min-h-11" : "min-h-24 sm:min-h-28")}>
          <Skeleton className="size-6 rounded-full" />
          {!compact && i % 3 === 0 ? <Skeleton className="mt-2 hidden h-4 w-full rounded sm:block" /> : null}
          {!compact && i % 5 === 0 ? <Skeleton className="mt-1 hidden h-4 w-3/4 rounded sm:block" /> : null}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <>
      <StatCardsSkeleton count={11} />
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <PanelSkeleton rows={6} className="xl:col-span-2" />
        <div className="surface-card min-w-0">
          <div className="border-b border-border px-5 py-4">
            <Skeleton className="h-5 w-44" />
          </div>
          <div className="p-5">
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[4.25rem] rounded-xl" />
              ))}
            </div>
          </div>
        </div>
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={4} />
        <div className="surface-card min-w-0 xl:col-span-3">
          <div className="border-b border-border px-5 py-4">
            <Skeleton className="h-5 w-56" />
          </div>
          <div className="mx-auto max-w-2xl p-5">
            <CalendarSkeleton compact />
          </div>
        </div>
      </div>
    </>
  );
}

/** Two-column detail page (booking, customer): main panels + side panels. */
export function DetailSkeleton({ actionBar = false, stats = 0 }: { actionBar?: boolean; stats?: number }) {
  return (
    <>
      {actionBar ? (
        <div className="surface-card mb-6 flex flex-wrap gap-2 p-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-lg" />
          ))}
        </div>
      ) : null}
      {stats > 0 ? <StatCardsSkeleton count={stats} className="mb-6 sm:grid-cols-3 xl:grid-cols-3" /> : null}
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="grid content-start gap-6">
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={2} />
        </div>
        <div className="grid content-start gap-6">
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={2} />
          <PanelSkeleton rows={3} />
        </div>
      </div>
    </>
  );
}

/** Stacked form sections (outfit editor, settings). */
export function FormSkeleton({ sections = 3, fields = 4 }: { sections?: number; fields?: number }) {
  return (
    <div className="grid gap-6">
      {Array.from({ length: sections }, (_, s) => (
        <div key={s} className="surface-card p-5 sm:p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: fields }, (_, f) => (
              <div key={f}>
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="mt-2 h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Skeleton className="h-12 w-44 rounded-full" />
    </div>
  );
}

export function PhotoGridSkeleton() {
  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
