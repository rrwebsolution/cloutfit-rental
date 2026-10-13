import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/admin/page-header";
import { CalendarSkeleton, LoadingRegion, PanelSkeleton } from "@/components/admin/skeletons";

// Shown instantly on navigation while this page's data loads.
export default function Loading() {
  return (
    <>
      <PageHeader title="Calendar" description="Reservations, rental periods, fittings and return dates in one view.">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </PageHeader>
      <LoadingRegion label="calendar">
        <div className="mb-4 flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <CalendarSkeleton />
          <PanelSkeleton rows={4} className="xl:self-start" />
        </div>
      </LoadingRegion>
    </>
  );
}
