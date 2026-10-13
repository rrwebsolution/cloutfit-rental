import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ActionButton } from "@/components/admin/action-button";
import { ImageManager } from "@/components/admin/image-manager";
import { OutfitForm } from "@/components/admin/outfit-form";
import { PageHeader, Panel, PanelEmpty } from "@/components/admin/page-header";
import { BookingStatusBadge, OutfitStatusBadge } from "@/components/shared/status-badge";
import { setOutfitArchived } from "@/lib/actions/catalogue";
import { isUuid } from "@/lib/actions/helpers";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BLOCKING_STATUSES } from "@/lib/constants";
import { formatDateRange, shopToday } from "@/lib/dates";
import type { BookingStatus, OutfitImage, OutfitStatus, OutfitVariant } from "@/lib/types";

export const metadata: Metadata = { title: "Edit Outfit" };

type Outfit = {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  description: string;
  rental_price: number;
  status: OutfitStatus;
  is_featured: boolean;
  internal_notes: string;
};

type UpcomingRow = {
  size: string;
  color: string;
  booking: { id: string; reference: string; customer_name: string; rental_start: string; rental_end: string; status: BookingStatus } | null;
};

export default async function EditOutfitPage({ params }: PageProps<"/admin/outfits/[id]">) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const today = shopToday();
  const [{ data: outfitRow }, { data: variants }, { data: images }, { data: categories }, { data: upcoming }] =
    await Promise.all([
      supabase.from("outfits").select("*").eq("id", id).maybeSingle(),
      supabase.from("outfit_variants").select("*").eq("outfit_id", id).order("size").order("color"),
      supabase.from("outfit_images").select("*").eq("outfit_id", id).order("is_primary", { ascending: false }).order("sort_order"),
      supabase.from("categories").select("id, name").order("sort_order"),
      supabase
        .from("booking_items")
        .select("size, color, booking:bookings!inner ( id, reference, customer_name, rental_start, rental_end, status )")
        .eq("outfit_id", id)
        .in("booking.status", BLOCKING_STATUSES)
        .gte("booking.rental_end", today),
    ]);

  const outfit = outfitRow as Outfit | null;
  if (!outfit) notFound();
  const archived = outfit.status === "archived";
  const upcomingRows = ((upcoming ?? []) as unknown as UpcomingRow[])
    .filter((r) => r.booking)
    .sort((a, b) => a.booking!.rental_start.localeCompare(b.booking!.rental_start));

  return (
    <>
      <PageHeader title={outfit.name} back={{ href: "/admin/outfits", label: "All outfits" }}>
        <OutfitStatusBadge status={outfit.status} />
        {!archived ? (
          <Link href={`/outfits/${outfit.slug}`} target="_blank" className={buttonVariants({ variant: "outline", size: "md" })}>
            <ExternalLink aria-hidden /> View on site
          </Link>
        ) : null}
        {archived ? (
          <ActionButton action={setOutfitArchived.bind(null, outfit.id, false)} variant="default">
            Restore Outfit
          </ActionButton>
        ) : (
          <ActionButton
            action={setOutfitArchived.bind(null, outfit.id, true)}
            variant="destructive"
            confirm={{
              title: `Archive ${outfit.name}?`,
              description:
                "It disappears from the website and can no longer be booked. Existing bookings and history are kept, and you can restore it any time.",
              confirmLabel: "Archive Outfit",
              destructive: true,
            }}
          >
            Archive
          </ActionButton>
        )}
      </PageHeader>

      {archived ? (
        <p className="mb-6 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          This outfit is archived and read-only. Restore it to edit or book it again.
        </p>
      ) : null}

      <div className="grid gap-6">
        <ImageManager outfitId={outfit.id} images={(images ?? []) as OutfitImage[]} disabled={archived} />

        <OutfitForm
          // Remount after a save so newly created variants pick up their ids.
          key={((variants ?? []) as OutfitVariant[]).map((v) => v.id).join(",")}
          outfitId={outfit.id}
          disabled={archived}
          categories={(categories ?? []) as { id: string; name: string }[]}
          initial={{
            name: outfit.name,
            slug: outfit.slug,
            category_id: outfit.category_id,
            description: outfit.description,
            rental_price: String(outfit.rental_price),
            status: archived ? "unavailable" : (outfit.status as "active" | "unavailable"),
            is_featured: outfit.is_featured,
            internal_notes: outfit.internal_notes,
            variants: ((variants ?? []) as OutfitVariant[]).map((v) => ({
              id: v.id,
              size: v.size,
              color: v.color,
              quantity: v.quantity,
              is_active: v.is_active,
            })),
          }}
        />

        <Panel title="Current & upcoming bookings" action={{ href: "/admin/availability", label: "Manage availability" }}>
          {upcomingRows.length === 0 ? (
            <PanelEmpty>No active or upcoming bookings for this outfit.</PanelEmpty>
          ) : (
            <ul className="divide-y divide-border">
              {upcomingRows.map((r) => (
                <li key={r.booking!.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="text-sm">
                    <Link href={`/admin/bookings/${r.booking!.id}`} className="font-medium text-primary hover:underline">
                      {r.booking!.reference}
                    </Link>
                    <span className="text-foreground"> · {r.booking!.customer_name}</span>
                    <p className="text-xs text-muted-foreground">
                      {formatDateRange(r.booking!.rental_start, r.booking!.rental_end)} · Size {r.size}, {r.color}
                    </p>
                  </div>
                  <BookingStatusBadge status={r.booking!.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
