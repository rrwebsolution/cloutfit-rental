import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  name = "Cloutfit Rental",
  href = "/",
  className,
  compact = false,
}: {
  name?: string;
  href?: string;
  className?: string;
  compact?: boolean;
}) {
  const [first, ...rest] = name.split(" ");
  return (
    <Link
      href={href}
      aria-label={`${name} — home`}
      className={cn("group inline-flex flex-col leading-none text-primary", className)}
    >
      <span className={cn("font-heading font-semibold tracking-wide", compact ? "text-xl" : "text-2xl")}>
        {first}
      </span>
      {rest.length > 0 ? (
        <span className="mt-1 text-[0.6rem] font-medium tracking-[0.42em] text-muted-red uppercase">
          {rest.join(" ")}
        </span>
      ) : null}
    </Link>
  );
}
