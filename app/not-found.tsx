import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 font-heading text-4xl sm:text-5xl">This page isn&apos;t in our collection</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The page you are looking for may have moved or no longer exists.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/catalogue" className={buttonVariants({ size: "xl" })}>
          Browse Collection
        </Link>
        <Link href="/" className={buttonVariants({ size: "xl", variant: "outline" })}>
          Back to Home
        </Link>
      </div>
    </main>
  );
}
