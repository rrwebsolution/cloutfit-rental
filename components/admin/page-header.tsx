import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  back,
  children,
}: {
  title: string;
  description?: string;
  back?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {back ? (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ChevronLeft className="size-4" aria-hidden /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </header>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  tone = "default",
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "alert";
  hint?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            tone === "alert" ? "bg-destructive/10 text-destructive" : "bg-accent text-primary",
          )}
        >
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      <p className={cn("mt-2 font-heading text-3xl", tone === "alert" ? "text-destructive" : "text-primary-dark")}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  const className = "surface-card block p-5 transition-shadow duration-300";
  return href ? (
    <Link href={href} className={cn(className, "hover:shadow-lift")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Titled card used for dashboard lists and detail-page sections. */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-card flex min-w-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="font-heading text-lg">{title}</h2>
        {action ? (
          <Link href={action.href} className="text-sm font-medium text-primary hover:underline">
            {action.label}
          </Link>
        ) : null}
      </div>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}

export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
