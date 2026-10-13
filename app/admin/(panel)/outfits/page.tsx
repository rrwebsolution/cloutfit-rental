import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Shirt, Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/admin/action-button";
import { PageHeader } from "@/components/admin/page-header";
import { Toolbar } from "@/components/admin/toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { OutfitImage } from "@/components/shared/outfit-image";
import { flattenParams, Pagination, withParams } from "@/components/shared/pagination";
import { OutfitStatusBadge } from "@/components/shared/status-badge";
import { setOutfitArchived } from "@/lib/actions/catalogue";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { searchTerm } from "@/lib/data/admin";
import { ADMIN_PAGE_SIZE, OUTFIT_STATUS_LABEL } from "@/lib/constants";
import { formatPeso } from "@/lib/format";
import type { OutfitStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Outfits" };

type Row = {
  id: string;
  name: string;
  slug: string;
  rental_price: number;
  status: OutfitStatus;
  is_featured: boolean;
  category: { name: string } | null;
  images: { url: string; is_primary: boolean; sort_order: number }[];
  variants: { size: string; color: string; quantity: number; is_active: boolean }[];
};

const STATUSES: OutfitStatus[] = ["active", "unavailable", "archived"];

export default async function OutfitsPage({ searchParams }: PageProps<"/admin/outfits">) {
  await requireStaff();
  const params = flattenParams(await searchParams);
  const supabase = await createClient();
  const page = Math.max(1, Number(params.page) || 1);
  const q = searchTerm(params.q);
  const status = STATUSES.includes(params.status as OutfitStatus) ? (params.status as OutfitStatus) : null;

  let query = supabase
    .from("outfits")
    .select(
      "id, name, slug, rental_price, status, is_featured, category:categories ( name ), images:outfit_images ( url, is_primary, sort_order ), variants:outfit_variants ( size, color, quantity, is_active )",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1);
  // Archived outfits are hidden unless asked for.
  query = status ? query.eq("status", status) : query.neq("status", "archived");
  if (params.category) query = query.eq("category_id", params.category);
  if (q) query = query.ilike("name", `%${q}%`);

  const [{ data, count }, { data: categories }] = await Promise.all([
    query,
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;

  return (
    <>
      <PageHeader title="Outfits" description="Your rental catalogue. Archived outfits keep their booking history.">
        <Link href="/admin/outfits/new" className={buttonVariants({ size: "md" })}>
          <Plus aria-hidden /> Add Outfit
        </Link>
      </PageHeader>
      <Toolbar
        searchPlaceholder="Search outfits…"
        filters={[
          {
            name: "category",
            label: "Category",
            all: "All categories",
            options: (categories ?? []).map((c) => ({ value: c.id as string, label: c.name as string })),
          },
          {
            name: "status",
            label: "Status",
            all: "Active & unavailable",
            options: STATUSES.map((s) => ({ value: s, label: OUTFIT_STATUS_LABEL[s] })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Shirt}
          title="No outfits found"
          description={q || status || params.category ? "Nothing matches your search or filters." : "Add your first outfit to start taking reservations."}
        >
          <Link href="/admin/outfits/new" className={buttonVariants({ size: "md" })}>
            <Plus aria-hidden /> Add Outfit
          </Link>
        </EmptyState>
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-5">Outfit</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Sizes</TableHead>
                <TableHead>Colors</TableHead>
                <TableHead>Rental price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o) => {
                const image = [...o.images].sort(
                  (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
                )[0];
                const active = o.variants.filter((v) => v.is_active);
                return (
                  <TableRow key={o.id}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <OutfitImage src={image?.url} alt="" sizes="44px" className="h-14 w-11 shrink-0 rounded-lg border border-border" />
                        <div>
                          <Link href={`/admin/outfits/${o.id}`} className="font-medium hover:text-primary">
                            {o.name}
                          </Link>
                          {o.is_featured ? (
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-primary">
                              <Star className="size-3 fill-current" aria-hidden /> Featured
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{o.category?.name ?? "—"}</TableCell>
                    <TableCell>{[...new Set(active.map((v) => v.size))].join(", ") || "—"}</TableCell>
                    <TableCell>{[...new Set(active.map((v) => v.color))].join(", ") || "—"}</TableCell>
                    <TableCell className="font-medium">{formatPeso(o.rental_price)}</TableCell>
                    <TableCell>
                      <OutfitStatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex justify-end gap-1.5">
                        <Link href={`/admin/outfits/${o.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          Edit
                        </Link>
                        {o.status === "archived" ? (
                          <ActionButton action={setOutfitArchived.bind(null, o.id, false)} size="sm">
                            Restore
                          </ActionButton>
                        ) : (
                          <ActionButton
                            action={setOutfitArchived.bind(null, o.id, true)}
                            size="sm"
                            variant="destructive"
                            confirm={{
                              title: `Archive ${o.name}?`,
                              description:
                                "It disappears from the website and can no longer be booked. Existing bookings and history are kept, and you can restore it any time.",
                              confirmLabel: "Archive Outfit",
                              destructive: true,
                            }}
                          >
                            Archive
                          </ActionButton>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-5">
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE))}
          total={total}
          label="outfits"
          hrefFor={(p) => withParams("/admin/outfits", params, { page: p })}
        />
      </div>
    </>
  );
}
