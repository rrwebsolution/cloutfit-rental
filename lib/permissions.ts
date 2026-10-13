import type { UserRole } from "@/lib/types";

// Central permission map. Add a permission here, grant it to roles, and check
// it with `can()` — no other file needs to know which role may do what.
export const PERMISSIONS = {
  "catalogue.manage": ["admin", "staff"],
  "bookings.manage": ["admin", "staff"],
  "fittings.manage": ["admin", "staff"],
  "payments.verify": ["admin", "staff"],
  "customers.manage": ["admin", "staff"],
  "settings.manage": ["admin"],
  "users.manage": ["admin"],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
}
