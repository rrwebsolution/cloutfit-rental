"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, ExternalLink, Eye, Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, fieldAria, FormError } from "@/components/shared/form-field";
import { FittingSlotPicker } from "@/components/site/fitting-slot-picker";
import {
  getPaymentProofUrl,
  rescheduleBooking,
  rescheduleFitting,
  updateBookingStatus,
} from "@/lib/actions/bookings";
import { BOOKING_STATUSES, BOOKING_STATUS_LABEL } from "@/lib/constants";
import type { ActionResult, BookingStatus } from "@/lib/types";

/** Shared submit logic for the small admin dialogs in this file. */
function useDialogAction(onDone: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const submit = (run: () => Promise<ActionResult<unknown>>) =>
    startTransition(async () => {
      const result = await run();
      if (result.ok) {
        setErrors({});
        setMessage("");
        toast.success(result.message);
        onDone();
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message);
      }
    });

  return { pending, errors, message, submit };
}

function SubmitFooter({ pending, label, onCancel }: { pending: boolean; label: string; onCancel: () => void }) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {label}
      </Button>
    </DialogFooter>
  );
}

// ---- Update status ---------------------------------------------------------------

export function UpdateStatusDialog({ bookingId, current }: { bookingId: string; current: BookingStatus }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<BookingStatus>(current);
  const [note, setNote] = useState("");
  const { pending, message, submit } = useDialogAction(() => {
    setOpen(false);
    setNote("");
  });

  return (
    <>
      <Button type="button" variant="outline" size="md" onClick={() => setOpen(true)}>
        <PenLine aria-hidden /> Update Status
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(() => updateBookingStatus(bookingId, status, note));
            }}
          >
            <DialogHeader>
              <DialogTitle>Update booking status</DialogTitle>
              <DialogDescription>
                The change is recorded in the status timeline with your name and the time.
              </DialogDescription>
            </DialogHeader>
            <Field id="status-select" label="New status" required>
              <NativeSelect
                className="w-full"
                value={status}
                onChange={(e) => setStatus(e.target.value as BookingStatus)}
                {...fieldAria("status-select")}
              >
                {BOOKING_STATUSES.map((s) => (
                  <NativeSelectOption key={s} value={s} disabled={s === current}>
                    {BOOKING_STATUS_LABEL[s]}
                    {s === current ? " (current)" : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field
              id="status-note"
              label={status === "cancelled" ? "Reason (shared with the customer)" : "Note"}
              hint={status === "cancelled" ? undefined : "Optional. Shown in the timeline."}
            >
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} {...fieldAria("status-note")} />
            </Field>
            <FormError message={message} />
            <SubmitFooter pending={pending} label="Update Status" onCancel={() => setOpen(false)} />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---- Reschedule rental dates ------------------------------------------------------

export function RescheduleBookingDialog({
  bookingId,
  rentalStart,
  rentalEnd,
}: {
  bookingId: string;
  rentalStart: string;
  rentalEnd: string;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(rentalStart);
  const [end, setEnd] = useState(rentalEnd);
  const { pending, errors, message, submit } = useDialogAction(() => setOpen(false));

  return (
    <>
      <Button type="button" variant="outline" size="md" onClick={() => setOpen(true)}>
        <CalendarClock aria-hidden /> Reschedule
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(() => rescheduleBooking({ booking_id: bookingId, rental_start: start, rental_end: end }));
            }}
          >
            <DialogHeader>
              <DialogTitle>Reschedule rental</DialogTitle>
              <DialogDescription>
                New dates are checked against other bookings. The customer is emailed the change.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="resched-start" label="Rental date" required error={errors.rental_start}>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} {...fieldAria("resched-start", errors.rental_start)} />
              </Field>
              <Field id="resched-end" label="Return date" required error={errors.rental_end}>
                <Input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} {...fieldAria("resched-end", errors.rental_end)} />
              </Field>
            </div>
            <FormError message={Object.keys(errors).length === 0 ? message : ""} />
            <SubmitFooter pending={pending} label="Save New Dates" onCancel={() => setOpen(false)} />
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---- Secure proof-of-payment preview --------------------------------------------------

export function ProofButton({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Fetch a fresh short-lived signed URL every time the preview is opened.
  const show = () =>
    startTransition(async () => {
      const result = await getPaymentProofUrl(paymentId);
      if (result.ok && result.data) {
        setUrl(result.data.url);
        setOpen(true);
      } else {
        toast.error(result.message);
      }
    });

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={show}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Eye aria-hidden />}
        View Proof
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setUrl(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Proof of payment</DialogTitle>
            <DialogDescription>Private file. This preview link expires in two minutes.</DialogDescription>
          </DialogHeader>
          {url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
              <img
                src={url}
                alt="Proof of payment submitted by the customer"
                className="max-h-[65vh] w-full rounded-lg border border-border bg-muted object-contain"
              />
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <ExternalLink className="size-4" aria-hidden /> Open full size
              </a>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---- Reschedule a fitting -------------------------------------------------------------

export function RescheduleFittingDialog({
  fittingId,
  today,
  maxDate,
}: {
  fittingId: string;
  today: string;
  maxDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState({ date: "", time: "" });
  const { pending, errors, message, submit } = useDialogAction(() => {
    setOpen(false);
    setSlot({ date: "", time: "" });
  });

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarClock aria-hidden /> Reschedule
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(() =>
                rescheduleFitting({ fitting_id: fittingId, fitting_date: slot.date, fitting_time: slot.time }),
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Reschedule fitting</DialogTitle>
              <DialogDescription>
                Only open slots are shown. The customer is emailed the new schedule.
              </DialogDescription>
            </DialogHeader>
            <FittingSlotPicker
              date={slot.date}
              time={slot.time}
              onChange={setSlot}
              minDate={today}
              maxDate={maxDate}
              error={errors.fitting_time ?? errors.fitting_date}
              idPrefix={`resched-${fittingId}`}
            />
            <FormError message={Object.keys(errors).length === 0 ? message : ""} />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !slot.date || !slot.time}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Save New Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
