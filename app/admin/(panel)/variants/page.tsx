import type { Metadata } from "next";
import Link from "next/link";
import { Tags } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { Toolbar } from "@/components/admin/toolbar";
import { VariantControls } from "@/components/admin/variant-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { flattenParams, Pagination, withParams } from "@/components/shared/pagination";
import { ToneBadge } from "@/components/shared/status-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { searchTerm } from "@/lib/data/admin";
import { shopToday } from "@/lib/dates";
import type { OutfitVariant } from "@/lib/types";

export const metadata: Metadata = { title: "Sizes / Variants" };

type Row = OutfitVariant & { outfit: { id: string; name: string; status: string } };
const PAGE = 25;

export default async function VariantsPage({ searchParams }: PageProps<"/admin/variants">) {
  await requireStaff();
  const params = flattenParams(await searchParams);
  const supabase = await createClient();
  const page = Math.max(1, Number(params.page) || 1);
  const q = searchTerm(params.q);
  const today = shopToday();

  let query = supabase
    .from("outfit_variants")
    .select("*, outfit:outfits!inner ( id, name, status )", { count: "exact" })
    .neq("outfit.status", "archived")
    .order("outfit_id")
    .order("size")
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.ilike("outfit.name", `%${q}%`);

  const [{ data, count }, { data: out }] = await Promise.all([
    query,
    // What is taken today, to show units currently free.
    supabase.rpc("get_availability", { p_from: today, p_to: today }),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const taken = new Map<string, number>();
  for (const r of (out ?? []) as { variant_id: string | null }[]) {
    if (r.variant_id) taken.set(r.variant_id, (taken.get(r.variant_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Sizes / Variants"
        description="Every size and color you stock. Adjust quantities or hide a variant; add new ones from the outfit's page."
      />
      <Toolbar searchPlaceholder="Search by outfit name…" />

      {rows.length === 0 ? (
        <EmptyState icon={Tags} title="No variants found" description="Variants are created when you add sizes and colors to an outfit." />
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-5">Outfit</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Free today</TableHead>
                <TableHead className="pr-5 text-right">Quantity &amp; visibility</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => {
                const free = Math.max(0, v.quantity - (taken.get(v.id) ?? 0));
                return (
                  <TableRow key={v.id}>
                    <TableCell className="pl-5 font-medium">
                      <Link href={`/admin/outfits/${v.outfit.id}`} className="hover:text-primary">
                        {v.outfit.name}
                      </Link>
                    </TableCell>
                    <TableCell>{v.size}</TableCell>
                    <TableCell>{v.color}</TableCell>
                    <TableCell>
                      <ToneBadge tone={free > 0 ? "success" : "warning"}>
                        {free} of {v.quantity}
                      </ToneBadge>
                    </TableCell>
                    <TableCell className="pr-5">
                      <VariantControls
                        key={`${v.id}-${v.quantity}-${v.is_active}`}
                        variantId={v.id}
                        quantity={v.quantity}
                        isActive={v.is_active}
                        label={`${v.outfit.name} ${v.size} ${v.color}`}
                      />
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
          pageCount={Math.max(1, Math.ceil(total / PAGE))}
          total={total}
          label="variants"
          hrefFor={(p) => withParams("/admin/variants", params, { page: p })}
        />
      </div>
    </>
  );
}
