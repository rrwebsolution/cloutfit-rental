"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormAction } from "@/components/shared/use-form-action";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/shared/form-field";
import {
  defaultMethodId,
  PaymentFields,
  PaymentInstructions,
  type PaymentInfo,
} from "@/components/site/payment-fields";
import { submitPayment } from "@/lib/actions/public";
import type { ActionResult } from "@/lib/types";

const initial: ActionResult = { ok: false, message: "" };

/** Reservation-fee submission on the customer's booking page. */
export function PaymentForm({
  reference,
  token,
  info,
  today,
}: {
  reference: string;
  token: string;
  info: PaymentInfo;
  today: string;
}) {
  const router = useRouter();
  const { state, pending, formProps } = useFormAction(submitPayment, initial);
  const [methodId, setMethodId] = useState(() => defaultMethodId(info.methods));

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
    } else {
      toast.error(state.message);
    }
  }, [state, router]);

  return (
    <form {...formProps} className="grid gap-5" noValidate>
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="token" value={token} />
      <PaymentInstructions info={info} selectedId={methodId} onSelect={setMethodId} />
      <PaymentFields info={info} methodId={methodId} today={today} errors={state.fieldErrors} />
      {!state.ok ? <FormError message={state.message} /> : null}
      <Button type="submit" size="xl" disabled={pending} className="sm:w-fit">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {pending ? "Submitting..." : "Submit Payment"}
      </Button>
    </form>
  );
}
