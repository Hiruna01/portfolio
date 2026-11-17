import { notFound } from "next/navigation";
import { AdminForm } from "@/components/admin/form";
import { ProjectDrafter } from "@/components/admin/project-drafter";
import { itemFields, itemToValues, LABELS, SEGMENTS } from "@/lib/admin-forms";
import { requireAdmin } from "@/lib/auth";
import { readItem } from "@/lib/store";
import type { Project } from "@/lib/types";
import { saveItemAction } from "../../../actions";

// Moving between admin pages is not instant either: each page checks the session first (see the panel layout).
export const instant = false;

export default async function ItemEditor({ params }: { params: Promise<{ section: string; id: string }> }) {
  await requireAdmin();
  const { section, id } = await params;
  const type = SEGMENTS[section];
  if (!type) notFound();

  const creating = id === "new";
  const item = creating ? null : await readItem(type, id);
  if (!creating && !item) notFound();

  return (
    <div className="max-w-[620px]">
      <h1 className="mb-6 text-[24px] font-medium tracking-[-0.015em] text-strong">
        {creating ? `Add ${LABELS[type].one}` : `Edit ${LABELS[type].one}`}
      </h1>
      {type === "project" ? (
        // Projects can be drafted, or refreshed, from a GitHub README; the admin still reviews and saves them.
        <ProjectDrafter
          fields={itemFields(type)}
          initial={itemToValues(type, item)}
          action={saveItemAction.bind(null, type, creating ? null : id)}
          submitLabel={creating ? `Add ${LABELS[type].one}` : "Save changes"}
          cancelHref={`/admin/${section}`}
          editing={!creating}
          refresh={creating ? undefined : { id, repo: githubOf(item) }}
        />
      ) : (
        <AdminForm
          fields={itemFields(type)}
          initial={itemToValues(type, item)}
          action={saveItemAction.bind(null, type, creating ? null : id)}
          submitLabel={creating ? `Add ${LABELS[type].one}` : "Save changes"}
          cancelHref={`/admin/${section}`}
          editing={!creating}
        />
      )}
    </div>
  );
}

/** The saved project's GitHub link, when it is one; the refresh box starts from it. */
function githubOf(item: unknown): string {
  const link = (item as Project | null)?.links?.github ?? "";
  return /^https:\/\/(www\.)?github\.com\//.test(link) ? link : "";
}
