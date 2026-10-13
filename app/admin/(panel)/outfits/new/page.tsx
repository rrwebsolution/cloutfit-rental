import type { Metadata } from "next";
import Link from "next/link";
import { FolderTree } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { OutfitForm } from "@/components/admin/outfit-form";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Add Outfit" };

export default async function NewOutfitPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("id, name").order("sort_order");

  return (
    <>
      <PageHeader
        title="Add Outfit"
        description="Save the details first — you can upload photos right after."
        back={{ href: "/admin/outfits", label: "All outfits" }}
      />
      {(categories ?? []).length === 0 ? (
        <EmptyState icon={FolderTree} title="Create a category first" description="Every outfit belongs to a category.">
          <Link href="/admin/categories" className={buttonVariants({ size: "md" })}>
            Manage Categories
          </Link>
        </EmptyState>
      ) : (
        <OutfitForm
          outfitId={null}
          categories={(categories ?? []) as { id: string; name: string }[]}
          initial={{
            name: "",
            slug: "",
            category_id: "",
            description: "",
            rental_price: "",
            status: "active",
            is_featured: false,
            internal_notes: "",
            variants: [{ size: "", color: "", quantity: 1, is_active: true }],
          }}
        />
      )}
    </>
  );
}
