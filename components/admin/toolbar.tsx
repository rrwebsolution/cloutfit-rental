"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { startNavigationProgress } from "@/components/shared/navigation-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export type ToolbarFilter = {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  /** Label of the empty option, e.g. "All statuses". */
  all: string;
};

/**
 * Search + filter bar for admin tables. Writes to the URL (resetting to page
 * 1), so lists are filtered and paginated on the server.
 */
export function Toolbar({
  searchPlaceholder,
  filters = [],
  dateFilter,
  keep = [],
}: {
  searchPlaceholder?: string;
  filters?: ToolbarFilter[];
  dateFilter?: { name: string; label: string };
  /** Query params to preserve across filter changes (e.g. "view"). */
  keep?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const names = [...(searchPlaceholder ? ["q"] : []), ...filters.map((f) => f.name), ...(dateFilter ? [dateFilter.name] : [])];
  const hasActive = names.some((n) => searchParams.get(n));

  const go = (params: URLSearchParams) => {
    const qs = params.toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    startNavigationProgress(href);
    startTransition(() => router.push(href));
  };

  const apply = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const key of keep) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    for (const name of names) {
      const value = String(data.get(name) ?? "").trim();
      if (value) params.set(name, value);
    }
    go(params);
  };

  const clear = () => {
    const params = new URLSearchParams();
    for (const key of keep) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    go(params);
  };

  return (
    <form
      key={searchParams.toString()}
      role="search"
      className="mb-4 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
    >
      {searchPlaceholder ? (
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            name="q"
            type="search"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-9"
          />
        </div>
      ) : null}
      {filters.map((filter) => (
        <NativeSelect
          key={filter.name}
          name={filter.name}
          aria-label={filter.label}
          defaultValue={searchParams.get(filter.name) ?? ""}
          onChange={(e) => e.currentTarget.form && apply(e.currentTarget.form)}
        >
          <NativeSelectOption value="">{filter.all}</NativeSelectOption>
          {filter.options.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ))}
      {dateFilter ? (
        <Input
          name={dateFilter.name}
          type="date"
          aria-label={dateFilter.label}
          defaultValue={searchParams.get(dateFilter.name) ?? ""}
          onChange={(e) => e.currentTarget.form && apply(e.currentTarget.form)}
          className="w-auto"
        />
      ) : null}
      {searchPlaceholder ? (
        <Button type="submit" variant="outline" size="md" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
          Search
        </Button>
      ) : pending ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />
      ) : null}
      {hasActive ? (
        <Button type="button" variant="ghost" size="md" className="text-primary" onClick={clear}>
          <X aria-hidden /> Clear
        </Button>
      ) : null}
    </form>
  );
}
