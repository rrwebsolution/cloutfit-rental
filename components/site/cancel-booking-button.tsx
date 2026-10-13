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
import { cancelBooking } from "@/lib/actions/public";

export function CancelBookingButton({ reference, token }: { reference: string; token: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await cancelBooking(reference, token, reason);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });

  return (
    <>
      <Button type="button" variant="destructive" size="md" onClick={() => setOpen(true)}>
        Cancel Booking
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking {reference}?</AlertDialogTitle>
            <AlertDialogDescription>
              Your outfit and dates will be released to other customers. The reservation fee is
              non-refundable. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep Booking</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirm}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Yes, Cancel It
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
