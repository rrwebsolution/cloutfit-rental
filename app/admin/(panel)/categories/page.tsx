import type { Metadata } from "next";
import { FolderTree } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/admin/action-button";
import { CategoryDialog } from "@/components/admin/category-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ToneBadge } from "@/components/shared/status-badge";
import { deleteCategory } from "@/lib/actions/catalogue";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "Categories" };

type Row = Category & { outfits: { status: string }[] };

export default async function CategoriesPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description, sort_order, is_active, outfits ( status )")
    .order("sort_order")
    .order("name");
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Categories" description="Group outfits by occasion or type.">
        <CategoryDialog />
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState icon={FolderTree} title="No categories yet" description="Add a category, then start adding outfits to it." />
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-16 pl-5">Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Outfits</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ outfits, ...category }) => {
                const live = outfits.filter((o) => o.status !== "archived").length;
                return (
                  <TableRow key={category.id}>
                    <TableCell className="pl-5 text-muted-foreground">{category.sort_order}</TableCell>
                    <TableCell>
                      <span className="font-medium">{category.name}</span>
                      <span className="block text-xs text-muted-foreground">/{category.slug}</span>
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal text-muted-foreground">{category.description || "—"}</TableCell>
                    <TableCell className="text-center">{live}</TableCell>
                    <TableCell>
                      <ToneBadge tone={category.is_active ? "success" : "muted"}>{category.is_active ? "Visible" : "Hidden"}</ToneBadge>
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex justify-end gap-1.5">
                        <CategoryDialog category={category} />
                        {outfits.length === 0 ? (
                          <ActionButton
                            action={deleteCategory.bind(null, category.id)}
                            size="sm"
                            variant="destructive"
                            confirm={{
                              title: `Delete ${category.name}?`,
                              description: "This category has no outfits and will be removed permanently.",
                              confirmLabel: "Delete Category",
                              destructive: true,
                            }}
                          >
                            Delete
                          </ActionButton>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Categories that contain outfits cannot be deleted — hide them from the site instead.
      </p>
    </>
  );
}
