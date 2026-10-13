import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminSidebar } from "@/components/admin/sidebar";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Cloutfit Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // The session is request data, so the authenticated shell streams in behind
  // a boundary. Nothing under /admin renders before requireStaff() passes.
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const [staff, settings] = await Promise.all([requireStaff(), getSettings()]);
  return (
    <div className="min-h-screen flex-1 bg-background">
      <AdminSidebar staff={staff} businessName={settings.business_name} />
      <div className="lg:pl-64">
        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-screen flex-1" aria-busy="true" aria-label="Loading admin">
      <div className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-sidebar p-6 lg:block">
        <Skeleton className="h-8 w-32" />
        <div className="mt-10 space-y-3">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="p-6 lg:pl-72">
        <Skeleton className="h-9 w-56" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
