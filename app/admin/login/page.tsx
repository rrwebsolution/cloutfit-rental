import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/components/admin/login-form";
import { Logo } from "@/components/shared/logo";
import { getStaff } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Admin Sign In",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <Logo />
        </div>
        <div className="surface-card mt-8 p-7 sm:p-9">
          <p className="eyebrow">Staff Access</p>
          <h1 className="mt-2 font-heading text-3xl">Admin sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your staff account to manage outfits, bookings and fittings.
          </p>
          <div className="mt-6">
            <Suspense fallback={<Skeleton className="h-56 w-full" />}>
              <SignedInRedirect />
              <LoginForm />
            </Suspense>
          </div>
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          Authorised staff only.{" "}
          <Link href="/" className="link-underline">
            Back to site
          </Link>
        </p>
      </div>
    </main>
  );
}

/** Already signed in as active staff? Skip the form. */
async function SignedInRedirect() {
  if (await getStaff()) redirect("/admin/dashboard");
  return null;
}
