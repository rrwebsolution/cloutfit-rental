"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { fetchAvailability } from "@/lib/actions/public";
import { dayStatuses } from "@/lib/availability";
import { addDays, endOfMonth } from "@/lib/dates";
import type { AvailabilityRange, AvailabilityStatus, PublicOutfit } from "@/lib/types";

type Variant = PublicOutfit["variants"][number];

/**
 * Availability data for an outfit calendar. Starts with the window loaded by
 * the server and lazily fetches further months as the customer pages ahead.
 */
export function useAvailability({
  outfit,
  variants,
  initialRanges,
  loadedFrom,
  loadedTo,
  initialMonth,
}: {
  outfit: Pick<PublicOutfit, "id" | "status">;
  /** Variants to judge availability on (usually the one selected). */
  variants: Variant[];
  initialRanges: AvailabilityRange[];
  loadedFrom: string;
  loadedTo: string;
  initialMonth: string;
}) {
  const [month, setMonthState] = useState(initialMonth);
  const [ranges, setRanges] = useState(initialRanges);
  const [loading, startTransition] = useTransition();
  const loadedUntil = useRef(loadedTo);

  const setMonth = useCallback(
    (next: string) => {
      setMonthState(next);
      const monthEnd = endOfMonth(`${next}-01`);
      if (monthEnd <= loadedUntil.current) return;
      const from = addDays(loadedUntil.current, 1);
      loadedUntil.current = monthEnd;
      startTransition(async () => {
        const more = await fetchAvailability(outfit.id, from, monthEnd);
        setRanges((prev) => [...prev, ...more]);
      });
    },
    [outfit.id],
  );

  const statuses = useMemo<Record<string, AvailabilityStatus>>(() => {
    const first = `${month}-01`;
    const from = first < loadedFrom ? loadedFrom : first;
    const to = endOfMonth(first);
    return to < from ? {} : dayStatuses(outfit, variants, ranges, from, to);
  }, [month, outfit, variants, ranges, loadedFrom]);

  /** True if every day in the range is free for the given variants. */
  const isRangeFree = useCallback(
    (from: string, to: string) =>
      Object.values(dayStatuses(outfit, variants, ranges, from, to)).every((s) => s === "available"),
    [outfit, variants, ranges],
  );

  return { month, setMonth, statuses, loading, isRangeFree };
}
