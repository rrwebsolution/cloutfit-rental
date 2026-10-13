import {
  Banknote,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  PackageCheck,
  ReceiptText,
  Ruler,
  Settings,
  Shirt,
  Tags,
  Undo2,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra words the command menu should match, e.g. "appointments". */
  keywords?: string;
  adminOnly?: boolean;
};

export type AdminNavGroup = { title: string; items: AdminNavItem[] };

/** Single source of truth for the admin sidebar and the command menu. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "General",
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: "home overview stats" }],
  },
  {
    title: "Catalogue",
    items: [
      { href: "/admin/outfits", label: "Outfits", icon: Shirt, keywords: "clothes gowns suits products photos" },
      { href: "/admin/categories", label: "Categories", icon: FolderTree, keywords: "groups types" },
      { href: "/admin/variants", label: "Sizes / Variants", icon: Tags, keywords: "colors stock quantity" },
      { href: "/admin/availability", label: "Availability", icon: CalendarRange, keywords: "blocked dates holiday" },
    ],
  },
  {
    title: "Rentals",
    items: [
      { href: "/admin/bookings", label: "Bookings", icon: ClipboardList, keywords: "orders reference" },
      { href: "/admin/bookings?view=reservations", label: "Reservations", icon: CalendarClock, keywords: "upcoming pickup" },
      { href: "/admin/fittings", label: "Fitting Appointments", icon: Ruler, keywords: "schedule slots" },
      { href: "/admin/rentals", label: "Active Rentals", icon: PackageCheck, keywords: "rented out" },
      { href: "/admin/returns", label: "Returns", icon: Undo2, keywords: "overdue due back" },
      { href: "/admin/calendar", label: "Calendar", icon: CalendarDays, keywords: "schedule month" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/admin/payments", label: "Payments", icon: Banknote, keywords: "gcash proof verify money" },
      { href: "/admin/payments?type=reservation_fee", label: "Reservation Fees", icon: ReceiptText, keywords: "deposit fee" },
    ],
  },
  {
    title: "Customers",
    items: [{ href: "/admin/customers", label: "Customer Records", icon: Users, keywords: "clients people contacts" }],
  },
  {
    title: "System",
    items: [
      { href: "/admin/users", label: "Users", icon: UserCog, keywords: "staff accounts admin roles", adminOnly: true },
      { href: "/admin/settings", label: "Settings", icon: Settings, keywords: "business fee gcash hours policies" },
    ],
  },
];
