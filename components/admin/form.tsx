/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { Field, FormState, Values } from "@/lib/admin-forms";

const input =
  "w-full rounded-lg border border-line bg-raise px-3 py-2 text-[14.5px] text-strong outline-none transition-colors placeholder:text-soft focus:border-soft disabled:opacity-60";

type Props = {
  fields: Field[];
  initial: Values;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  cancelHref?: string;
  /** True when editing an existing record, which locks fields marked lockOnEdit. */
  editing?: boolean;
  /** Fields filled by the GitHub drafter, marked so the admin knows what to check. */
  marked?: string[];
};

export function AdminForm({ fields, initial, action, submitLabel, cancelHref, editing = false, marked = [] }: Props) {
  const [state, formAction, pending] = useActionState(action, { n: 0 });
  const values = state.values ?? initial;

  // Select values are tracked so fields that depend on them can appear and disappear as the choice changes.
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.filter((f) => f.kind === "select").map((f) => [f.name, String(initial[f.name] ?? f.options?.[0]?.value ?? "")])),
  );

  // After a submit, bring the result (errors or the saved notice) into view; the save button sits below a long form.
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.n > 0) notice.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state.n]);

  const visible = fields.filter((f) => !f.showWhen || f.showWhen.in.includes(selected[f.showWhen.field]));

  return (
    // The key remounts the inputs after each submit, so a rejected form comes back filled in as it was typed.
    <form action={formAction} key={state.n} className="space-y-5">
      <div ref={notice} className="scroll-mt-24 space-y-5 empty:hidden">
      {state.errors && (
        <div role="alert" className="rounded-[10px] border border-dashed border-warn px-4 py-3 text-[14px] text-strong">
          <p className="mb-1 font-medium">Nothing was saved. Fix these and save again:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {state.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {state.ok && (
        <p role="status" className="rounded-[10px] border border-dashed border-ok px-4 py-3 text-[14px] text-strong">
          {state.message}
        </p>
      )}
      </div>

      {visible.map((field) => {
        const id = `f-${field.name}`;
        const value = values[field.name];
        const locked = editing && field.lockOnEdit;

        if (field.kind === "checkbox") {
          return (
            <div key={field.name}>
              <label htmlFor={id} className="flex items-center gap-2.5 text-[14.5px] text-strong">
                <input id={id} name={field.name} type="checkbox" defaultChecked={value === true} className="size-4 accent-[var(--strong)]" />
                {field.label}
              </label>
              {field.help && <p className="mt-1 pl-[26px] text-[13px]">{field.help}</p>}
            </div>
          );
        }

        return (
          <div key={field.name}>
            <label htmlFor={id} className="mb-1.5 flex items-center gap-2 text-[13.5px] font-medium text-strong">
              {field.label}
              {marked.includes(field.name) && (
                <span className="rounded-full bg-chip px-2 py-px text-[11.5px] font-normal text-body">drafted, check this</span>
              )}
            </label>
            {field.kind === "textarea" && (
              <textarea id={id} name={field.name} rows={field.rows ?? 3} defaultValue={String(value ?? "")} className={`${input} resize-y leading-relaxed`} />
            )}
            {field.kind === "media" && (
              <div className="space-y-2">
                <textarea
                  id={id}
                  name={field.name}
                  rows={field.rows ?? 4}
                  defaultValue={String(value ?? "")}
                  placeholder="https://… | caption"
                  className={`${input} resize-y font-mono text-[13px] leading-relaxed`}
                />
                <input
                  name={`${field.name}_files`}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  aria-label={`Upload images for ${field.label.toLowerCase()}`}
                  className="block w-full text-[13.5px] file:mr-3 file:rounded-lg file:border file:border-line file:bg-raise file:px-3 file:py-1.5 file:text-[13.5px] file:text-strong"
                />
              </div>
            )}
            {field.kind === "swatches" && (
              <div role="radiogroup" aria-label={field.label} className="flex flex-wrap gap-2.5">
                {field.options?.map((option) => (
                  <label key={option.value} className="group cursor-pointer text-center">
                    <input
                      type="radio"
                      name={field.name}
                      value={option.value}
                      defaultChecked={String(value ?? field.options?.[0]?.value) === option.value}
                      className="peer sr-only"
                    />
                    <span
                      className={`block h-11 w-16 rounded-[9px] ring-1 ring-line transition-shadow group-hover:ring-soft peer-checked:ring-2 peer-checked:ring-accent peer-checked:ring-offset-2 peer-checked:ring-offset-bg peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${option.swatch ?? ""}`}
                      aria-hidden="true"
                    />
                    <span className="mt-1.5 block text-[12.5px] text-body peer-checked:font-medium peer-checked:text-strong">{option.label}</span>
                  </label>
                ))}
              </div>
            )}
            {field.kind === "select" && (
              <select
                id={id}
                name={field.name}
                value={selected[field.name]}
                onChange={(e) => setSelected((s) => ({ ...s, [field.name]: e.target.value }))}
                className={input}
              >
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            {(field.kind === "text" || field.kind === "number") && (
              <input
                id={id}
                name={field.name}
                type={field.kind === "number" ? "number" : "text"}
                defaultValue={String(value ?? "")}
                readOnly={locked}
                autoComplete="off"
                className={`${input} ${locked ? "cursor-not-allowed opacity-60" : ""}`}
              />
            )}
            {field.kind === "image" && (
              <div className="space-y-2">
                {typeof value === "string" && value && (
                  <img src={value} alt="" className="h-20 w-auto rounded-lg border border-line bg-white object-cover" />
                )}
                <input id={id} name={field.name} type="text" defaultValue={String(value ?? "")} placeholder="https://… or leave empty" autoComplete="off" className={input} />
                <input
                  name={`${field.name}_file`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  aria-label={`Upload ${field.label.toLowerCase()}`}
                  className="block w-full text-[13.5px] file:mr-3 file:rounded-lg file:border file:border-line file:bg-raise file:px-3 file:py-1.5 file:text-[13.5px] file:text-strong"
                />
              </div>
            )}
            {field.help && <p className="mt-1.5 text-[13px]">{field.help}</p>}
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-strong px-4 py-2 text-[14px] font-medium text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {cancelHref && (
          <Link href={cancelHref} className="rounded-lg px-3 py-2 text-[14px] hover:text-strong">
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
