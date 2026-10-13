import type { Metadata } from "next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { AddUserDialog, UserRowControls } from "@/components/admin/user-controls";
import { ToneBadge } from "@/components/shared/status-badge";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort } from "@/lib/dates";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const staff = await requirePermission("users.manage");
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active, created_at")
    .order("created_at");
  const rows = (data ?? []) as Profile[];

  return (
    <>
      <PageHeader title="Users" description="Staff accounts that can sign in to this dashboard.">
        <AddUserDialog />
      </PageHeader>

      <div className="surface-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-5">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="pr-5 text-right">Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="pl-5 font-medium">{u.full_name || "—"}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <ToneBadge tone={u.role === "admin" ? "primary" : "neutral"}>{u.role === "admin" ? "Admin" : "Staff"}</ToneBadge>
                </TableCell>
                <TableCell>
                  <ToneBadge tone={u.is_active ? "success" : "muted"}>{u.is_active ? "Active" : "Disabled"}</ToneBadge>
                </TableCell>
                <TableCell>{formatDateShort(u.created_at.slice(0, 10), true)}</TableCell>
                <TableCell className="pr-5">
                  <UserRowControls
                    key={`${u.id}-${u.role}-${u.is_active}`}
                    userId={u.id}
                    role={u.role}
                    isActive={u.is_active}
                    isSelf={u.id === staff.id}
                    name={u.full_name || u.email}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Accounts are never deleted, so the history of who verified a payment or changed a booking stays intact. Disable an account to remove its access.
      </p>
    </>
  );
}
