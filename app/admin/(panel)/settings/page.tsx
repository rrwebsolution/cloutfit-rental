import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { PaymentMethodsManager } from "@/components/admin/payment-methods-manager";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireStaff } from "@/lib/auth";
import { qrImageUrl } from "@/lib/data/payment-methods";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { settingsFromRows } from "@/lib/settings";
import type { PaymentMethod } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  ["business", "Business Information"],
  ["booking", "Booking Settings"],
  ["fitting", "Fitting Settings"],
  ["payment", "Payment & Reservation"],
  ["notifications", "Notifications"],
  ["policies", "Rental Policies"],
] as const;

export default async function SettingsPage() {
  const staff = await requireStaff();
  const supabase = await createClient();
  // Read straight from the database (not the public cache), including private
  // settings and disabled or archived payment methods.
  const [{ data }, { data: methods }] = await Promise.all([
    supabase.from("system_settings").select("key, value"),
    supabase.from("payment_methods").select("*").order("sort_order").order("created_at"),
  ]);
  const rows = (data ?? []) as { key: string; value: unknown }[];
  const notification = rows.find((r) => r.key === "notification_email")?.value;
  const canEdit = can(staff.role, "settings.manage");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Business details and booking rules. Changes apply immediately — no code changes needed."
      />

      <nav aria-label="Settings sections" className="mb-5 flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
          >
            {label}
          </a>
        ))}
      </nav>

      <SettingsForm
        initial={{
          ...settingsFromRows(rows),
          notification_email: typeof notification === "string" ? notification : "",
        }}
        canEdit={canEdit}
        envNotificationEmail={Boolean(process.env.ADMIN_NOTIFICATION_EMAIL)}
        paymentMethods={
          <PaymentMethodsManager
            canEdit={canEdit}
            methods={((methods ?? []) as PaymentMethod[]).map((m) => ({ ...m, qr_url: qrImageUrl(m.qr_image_path) }))}
          />
        }
      />
    </>
  );
}
