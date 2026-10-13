import { ActionButton } from "@/components/admin/action-button";
import { RescheduleFittingDialog } from "@/components/admin/booking-dialogs";
import { updateFitting } from "@/lib/actions/bookings";
import { ACTIVE_FITTING_STATUSES } from "@/lib/constants";
import type { FittingStatus } from "@/lib/types";

/** Confirm / Reschedule / Complete / Cancel for one fitting appointment. */
export function FittingActions({
  fittingId,
  status,
  today,
  maxDate,
}: {
  fittingId: string;
  status: FittingStatus;
  today: string;
  maxDate: string;
}) {
  if (!ACTIVE_FITTING_STATUSES.includes(status)) return null;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {status !== "confirmed" ? (
        <ActionButton action={updateFitting.bind(null, fittingId, "confirm")} size="sm" variant="default">
          Confirm
        </ActionButton>
      ) : null}
      <RescheduleFittingDialog fittingId={fittingId} today={today} maxDate={maxDate} />
      <ActionButton action={updateFitting.bind(null, fittingId, "complete")} size="sm">
        Complete
      </ActionButton>
      <ActionButton
        action={updateFitting.bind(null, fittingId, "cancel")}
        size="sm"
        variant="destructive"
        confirm={{
          title: "Cancel this fitting?",
          description: "The slot is released and the customer is emailed.",
          confirmLabel: "Cancel Fitting",
          destructive: true,
        }}
      >
        Cancel
      </ActionButton>
    </div>
  );
}
