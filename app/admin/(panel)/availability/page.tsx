import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { BlockedDateForm } from "@/components/admin/blocked-date-form";
import { PageHeader, Panel, PanelEmpty } from "@/components/admin/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AvailabilityBadge, ToneBadge } from "@/components/shared/status-badge";
import { deleteBlockedDate } from "@/lib/actions/catalogue";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { outfitStatus } from "@/lib/availability";
import { addDays, formatDateRange, formatDateShort, shopToday } from "@/lib/dates";
import type { AvailabilityRange, BlockedDate, OutfitStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Availability" };

type OutfitRow = {
  id: string;
  name: string;
  status: OutfitStatus;
  variants: { id: string; size: string; color: string; quantity: number; is_active: boolean }[];
};
type BlockRow = BlockedDate & { outfit: { name: string } | null };

const SCOPE_LABEL = { all: "Rentals & fittings", rental: "Rentals only", fitting: "Fittings only" } as const;

export default async function AvailabilityPage() {
  await requireStaff();
  const supabase = await createClient();
  const today = shopToday();
  const horizon = addDays(today, 13);

  const [{ data: outfits }, { data: blocks }, { data: ranges }] = await Promise.all([
    supabase
      .from("outfits")
      .select("id, name, status, variants:outfit_variants ( id, size, color, quantity, is_active )")
      .neq("status", "archived")
      .order("name"),
    supabase
      .from("blocked_dates")
      .select("*, outfit:outfits ( name )")
      .gte("date_to", today)
      .order("date_from"),
    supabase.rpc("get_availability", { p_from: today, p_to: horizon }),
  ]);

  const outfitRows = (outfits ?? []) as unknown as OutfitRow[];
  const blockRows = (blocks ?? []) as unknown as BlockRow[];
  const rangeRows = (ranges ?? []) as AvailabilityRange[];
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  return (
    <>
      <PageHeader
        title="Availability"
        description="Availability follows bookings automatically. Block dates here for holidays, cleaning or repairs."
      />

      <div className="grid gap-6">
        <Panel title="Block dates">
          <BlockedDateForm outfits={outfitRows.map((o) => ({ id: o.id, name: o.name }))} today={today} />
          <div className="mt-6 border-t border-border pt-4">
            {blockRows.length === 0 ? (
              <PanelEmpty>No current or upcoming blocked dates.</PanelEmpty>
            ) : (
              <ul className="divide-y divide-border">
                {blockRows.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="text-sm">
                      <p className="font-medium text-foreground">{formatDateRange(b.date_from, b.date_to)}</p>
                      <p className="text-muted-foreground">
                        {b.outfit?.name ?? "Whole shop"} · {SCOPE_LABEL[b.scope]}
                        {b.reason ? ` · ${b.reason}` : ""}
                      </p>
                    </div>
                    <ActionButton
                      action={deleteBlockedDate.bind(null, b.id)}
                      size="sm"
                      variant="destructive"
                      confirm={{
                        title: "Remove this block?",
                        description: "The dates become bookable again.",
                        confirmLabel: "Remove Block",
                        destructive: true,
                      }}
                    >
                      Remove
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title="Next 14 days">
          {outfitRows.length === 0 ? (
            <PanelEmpty>Add outfits to see their availability.</PanelEmpty>
          ) : (
            <>
              <div className="-mx-5 overflow-x-auto px-5">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="sticky left-0 z-10 min-w-44 bg-card">Outfit</TableHead>
                      <TableHead>Today</TableHead>
                      {days.map((d) => (
                        <TableHead key={d} className="px-1 text-center text-xs font-normal text-muted-foreground">
                          {formatDateShort(d).replace(" ", " ")}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outfitRows.map((o) => {
                      const variants = o.variants.filter((v) => v.is_active);
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="sticky left-0 z-10 bg-card font-medium">
                            <Link href={`/admin/outfits/${o.id}`} className="hover:text-primary">
                              {o.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <AvailabilityBadge status={outfitStatus(o, variants, rangeRows, today, today)} />
                          </TableCell>
                          {days.map((d) => {
                            const status = outfitStatus(o, variants, rangeRows, d, d);
                            return (
                              <TableCell key={d} className="px-1 text-center">
                                <span
                                  title={`${formatDateShort(d)}: ${status}`}
                                  className={
                                    "mx-auto block size-5 rounded " +
                                    {
                                      available: "border border-border bg-surface",
                                      reserved: "bg-warning/30",
                                      rented: "bg-primary/85",
                                      unavailable: "bg-muted-foreground/25",
                                    }[status]
                                  }
                                >
                                  <span className="sr-only">{status}</span>
                                </span>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <ToneBadge tone="neutral">□ Available</ToneBadge>
                <ToneBadge tone="warning">Reserved</ToneBadge>
                <ToneBadge tone="primary">Rented</ToneBadge>
                <ToneBadge tone="muted">Unavailable / blocked</ToneBadge>
              </div>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
