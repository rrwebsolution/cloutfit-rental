"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { startNavigationProgress } from "@/components/shared/navigation-progress";
import type { ActionResult } from "@/lib/types";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * Button that runs a Server Action, shows the result as a toast and refreshes
 * the page data. Optionally asks for confirmation and/or a typed reason first.
 *
 * `action` is usually a bound Server Action passed from a Server Component:
 *   <ActionButton action={verifyPayment.bind(null, payment.id)}>Verify</ActionButton>
 * With `reason`, the typed text is passed as the action's final argument.
 */
export function ActionButton({
  action,
  children,
  confirm,
  reason,
  variant = "outline",
  size = "md",
  className,
  redirectTo,
}: {
  action: (reason: string) => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  confirm?: { title: string; description: string; confirmLabel?: string; destructive?: boolean };
  reason?: { label: string; required?: boolean; placeholder?: string };
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  /** Navigate here after success instead of refreshing in place. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const needsDialog = Boolean(confirm || reason);

  const run = () =>
    startTransition(async () => {
      const result = await action(text.trim());
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        setText("");
        if (redirectTo) {
          startNavigationProgress(redirectTo);
          router.push(redirectTo);
        } else router.refresh();
      } else {
        toast.error(result.message);
      }
    });

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        onClick={() => (needsDialog ? setOpen(true) : run())}
      >
        {pending && !needsDialog ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </Button>

      {needsDialog ? (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm?.title ?? "Please confirm"}</AlertDialogTitle>
              <AlertDialogDescription>
                {confirm?.description ?? "Add the details below, then confirm."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {reason ? (
              <div className="grid gap-1.5">
                <Label htmlFor="action-reason">
                  {reason.label}
                  {reason.required ? <span className="text-primary">*</span> : null}
                </Label>
                <Textarea
                  id="action-reason"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={reason.placeholder}
                  maxLength={300}
                  rows={3}
                />
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Back</AlertDialogCancel>
              <Button
                type="button"
                variant={confirm?.destructive ? "destructive" : "default"}
                disabled={pending || Boolean(reason?.required && text.trim().length < 3)}
                onClick={run}
              >
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {confirm?.confirmLabel ?? "Confirm"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
