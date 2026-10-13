"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Field, fieldAria, FormError } from "@/components/shared/form-field";
import { createUser, updateUser } from "@/lib/actions/system";
import type { UserRole } from "@/lib/types";

export function AddUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    startTransition(async () => {
      const result = await createUser(data);
      if (result.ok) {
        toast.success(result.message);
        setErrors({});
        setMessage("");
        setOpen(false);
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.fieldErrors ? "" : result.message);
      }
    });
  };

  return (
    <>
      <Button type="button" size="md" onClick={() => setOpen(true)}>
        <UserPlus aria-hidden /> Add User
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>Add a staff account</DialogTitle>
              <DialogDescription>
                They can sign in right away with this email and password. Share the password securely.
              </DialogDescription>
            </DialogHeader>
            <Field id="user-name" label="Full name" required error={errors.full_name}>
              <Input name="full_name" autoComplete="off" {...fieldAria("user-name", errors.full_name)} />
            </Field>
            <Field id="user-email" label="Email" required error={errors.email}>
              <Input name="email" type="email" autoComplete="off" {...fieldAria("user-email", errors.email)} />
            </Field>
            <Field id="user-password" label="Temporary password" required error={errors.password} hint="At least 8 characters.">
              <Input name="password" type="password" autoComplete="new-password" {...fieldAria("user-password", errors.password, "hint")} />
            </Field>
            <Field id="user-role" label="Role" required error={errors.role}>
              <NativeSelect name="role" className="w-full" defaultValue="staff" {...fieldAria("user-role", errors.role)}>
                <NativeSelectOption value="staff">Staff — bookings, fittings, payments, catalogue</NativeSelectOption>
                <NativeSelectOption value="admin">Admin — everything, plus users and settings</NativeSelectOption>
              </NativeSelect>
            </Field>
            <FormError message={message} />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {pending ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Role + access controls for one user row. Disabled for your own account. */
export function UserRowControls({
  userId,
  role,
  isActive,
  isSelf,
  name,
}: {
  userId: string;
  role: UserRole;
  isActive: boolean;
  isSelf: boolean;
  name: string;
}) {
  const router = useRouter();
  const [currentRole, setCurrentRole] = useState(role);
  const [active, setActive] = useState(isActive);
  const [pending, startTransition] = useTransition();

  const save = (patch: { role?: UserRole; is_active?: boolean }, revert: () => void) =>
    startTransition(async () => {
      const result = await updateUser(userId, patch);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
        revert();
      }
    });

  if (isSelf) return <p className="text-right text-xs text-muted-foreground">This is you</p>;

  return (
    <div className="flex items-center justify-end gap-3">
      <NativeSelect
        size="sm"
        aria-label={`Role for ${name}`}
        value={currentRole}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as UserRole;
          const previous = currentRole;
          setCurrentRole(next);
          save({ role: next }, () => setCurrentRole(previous));
        }}
      >
        <NativeSelectOption value="staff">Staff</NativeSelectOption>
        <NativeSelectOption value="admin">Admin</NativeSelectOption>
      </NativeSelect>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={active}
          disabled={pending}
          aria-label={`Dashboard access for ${name}`}
          onCheckedChange={(checked) => {
            setActive(checked);
            save({ is_active: checked }, () => setActive(!checked));
          }}
        />
        <span className="w-16 text-left text-muted-foreground">{active ? "Active" : "Disabled"}</span>
      </label>
    </div>
  );
}
