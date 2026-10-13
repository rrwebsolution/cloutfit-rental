"use client";

import { useSearchParams } from "next/navigation";
import { useFormAction } from "@/components/shared/use-form-action";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, fieldAria, FormError } from "@/components/shared/form-field";
import { signIn } from "@/lib/actions/auth";
import type { ActionResult } from "@/lib/types";

const initial: ActionResult = { ok: false, message: "" };

export function LoginForm() {
  const searchParams = useSearchParams();
  const { state, pending, formProps } = useFormAction(signIn, initial);
  const errors = state.fieldErrors ?? {};

  return (
    <form {...formProps} className="grid gap-4" noValidate>
      <FormError message={state.message} />
      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />
      <Field id="login-email" label="Email" required error={errors.email}>
        <Input name="email" type="email" autoComplete="username" autoFocus {...fieldAria("login-email", errors.email)} />
      </Field>
      <Field id="login-password" label="Password" required error={errors.password}>
        <Input name="password" type="password" autoComplete="current-password" {...fieldAria("login-password", errors.password)} />
      </Field>
      
      <Button type="submit" size="xl" disabled={pending} className="mt-1">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
        {pending ? "Signing in…" : "Sign In"}
      </Button>
    </form>
  );
}
