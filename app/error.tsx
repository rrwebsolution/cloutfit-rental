"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-4 font-heading text-4xl">We hit a snag</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Please try again. If the problem continues, contact us and we will help you right away.
      </p>
      {error.digest ? <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <Button size="xl" className="mt-8" onClick={reset}>
        Try Again
      </Button>
    </main>
  );
}
