"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

/** A button that runs a server action, asking first when `confirm` is set. */
export function ActionButton({
  action,
  children,
  confirm,
  label,
  className = "",
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  confirm?: string;
  label?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <Submit label={label} className={className}>
        {children}
      </Submit>
    </form>
  );
}

function Submit({ children, label, className }: { children: React.ReactNode; label?: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label={label} className={`transition-colors hover:text-strong disabled:opacity-40 ${className}`}>
      {children}
    </button>
  );
}

const field =
  "w-full rounded-lg border border-line bg-raise px-3 py-2.5 text-[15px] text-strong outline-none transition-colors focus:border-soft";

export function LoginForm({ action }: { action: (state: { error?: string }, form: FormData) => Promise<{ error?: string }> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-[10px] border border-dashed border-warn px-4 py-3 text-[14px] text-strong">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="username" className="mb-1.5 block text-[13.5px] font-medium text-strong">
          Username
        </label>
        <input id="username" name="username" type="text" autoComplete="username" required maxLength={100} className={field} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[13.5px] font-medium text-strong">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={200} className={field} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-strong px-4 py-2.5 text-[14.5px] font-medium text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
