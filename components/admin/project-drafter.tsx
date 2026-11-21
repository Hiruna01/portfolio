"use client";

import { useActionState, type ComponentProps } from "react";
import { draftProjectAction, type DraftState } from "@/app/admin/actions";
import { AdminForm } from "./form";

const input =
  "w-full rounded-lg border border-line bg-raise px-3 py-2 text-[14.5px] text-strong outline-none transition-colors placeholder:text-soft focus:border-soft disabled:opacity-60";

type Props = ComponentProps<typeof AdminForm> & {
  /** Set on the edit page: the saved project to refresh, and its GitHub link to start from. */
  refresh?: { id: string; repo: string };
};

/**
 * A project form with a GitHub box above it: "Draft from GitHub" when adding a project, "Refresh from README"
 * when editing one. A draft only fills the form; nothing is saved until the admin presses the form's own button.
 */
export function ProjectDrafter({ refresh, ...props }: Props) {
  const [state, draftAction, pending] = useActionState<DraftState, FormData>(draftProjectAction, { n: 0 });
  const drafted = Boolean(state.values);

  return (
    <>
      <form action={draftAction} className="mb-8 rounded-[12px] border border-dashed border-dash p-4">
        <label htmlFor="draft-repo" className="mb-1 block text-[13.5px] font-medium text-strong">
          {refresh ? "Refresh from README" : "Draft from GitHub"}
        </label>
        <p className="mb-3 text-[13px]">
          {refresh
            ? "Reads the repository's README again and rewrites the text fields below. The id, date, pictures and videos, and display settings stay as they are, and nothing is saved until you save changes."
            : "Paste a public repository link. I'll read its README and fill in the form below. Pictures and videos are left for you, and nothing is saved until you add the project."}
        </p>
        {refresh && <input type="hidden" name="projectId" value={refresh.id} />}
        <div className="flex gap-2">
          <input
            id="draft-repo"
            name="repo"
            type="url"
            required
            defaultValue={state.repo ?? refresh?.repo ?? ""}
            placeholder="https://github.com/you/project"
            autoComplete="off"
            disabled={pending}
            className={input}
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-lg bg-strong px-4 py-2 text-[14px] font-medium text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {pending ? "Reading the README…" : refresh ? "Refresh" : "Draft"}
          </button>
        </div>
        {drafted && (
          <p className="mt-2 text-[12.5px] text-soft">
            {refresh ? "Refreshing again replaces the drafted fields below." : "Drafting again replaces everything in the form below."}
          </p>
        )}

        <div aria-live="polite">
          {state.error && (
            <p role="alert" className="mt-3 rounded-[10px] border border-dashed border-warn px-3 py-2 text-[13.5px] text-strong">
              {state.error}
            </p>
          )}
          {drafted && !state.error && (
            <div role="status" className="mt-3 rounded-[10px] border border-dashed border-ok px-3 py-2 text-[13.5px] text-strong">
              <p>
                {refresh
                  ? "Refreshed from the README. Check every marked field before saving your changes."
                  : "Drafted from the README. Check every marked field before adding the project."}
              </p>
              {state.notes?.map((note) => (
                <p key={note} className="mt-1 text-body">
                  {note}
                </p>
              ))}
            </div>
          )}
        </div>
      </form>

      {/* The key remounts the form with the draft's values each time a new draft arrives. */}
      <AdminForm key={`draft-${state.drafts ?? 0}`} {...props} initial={state.values ?? props.initial} marked={state.filled ?? []} />
    </>
  );
}
