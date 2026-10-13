"use client";

import { useActionState, useTransition } from "react";

/**
 * `useActionState` for forms that must KEEP what the user typed when the
 * server returns an error.
 *
 * React resets a `<form action={...}>` after every submission, which would
 * wipe the fields (and an attached file) on a validation error. Submitting
 * through `onSubmit` avoids that reset. `action` is still set, so the form
 * also works before JavaScript has loaded.
 */
export function useFormAction<State>(
  action: (state: Awaited<State>, formData: FormData) => State | Promise<State>,
  initialState: Awaited<State>,
) {
  const [state, dispatch, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };

  return { state, pending, formProps: { action: dispatch, onSubmit } };
}
