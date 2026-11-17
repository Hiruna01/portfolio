import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/buttons";
import { LABELS, SEGMENTS } from "@/lib/admin-forms";
import { requireAdmin } from "@/lib/auth";
import { readArticles, readPosts, readProjects } from "@/lib/store";
import { deleteItemAction, moveItemAction } from "../../actions";

// Moving between admin pages is not instant either: each page checks the session first (see the panel layout).
export const instant = false;

export default async function ItemList({ params }: { params: Promise<{ section: string }> }) {
  await requireAdmin();
  const { section } = await params;
  const type = SEGMENTS[section];
  if (!type) notFound();

  const items: { id: string; title: string; featured?: boolean; note: string }[] =
    type === "project" ? (await readProjects()).map((p) => ({ ...p, note: `${p.category}, ${p.date}` }))
    : type === "article" ? (await readArticles()).map((a) => ({ ...a, note: a.date }))
    : (await readPosts()).map((c) => ({ ...c, note: c.kind }));

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-medium tracking-[-0.015em] text-strong">{LABELS[type].many}</h1>
        <Link href={`/admin/${section}/new`} className="rounded-lg bg-strong px-3.5 py-2 text-[14px] font-medium text-bg transition-opacity hover:opacity-85">
          Add {LABELS[type].one}
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-dash px-5 py-6 text-[14.5px]">
          No {LABELS[type].many.toLowerCase()} yet. Add the first one and it will appear on the site straight away.
        </p>
      ) : (
        <ul className="border-t border-dashed border-dash">
          {items.map((item, i) => (
            <li key={item.id} className="flex items-center gap-3 border-b border-dashed border-dash py-3">
              <div className="flex flex-col text-soft">
                <ActionButton action={moveItemAction.bind(null, type, item.id, "up")} label={`Move ${item.title} up`} className={i === 0 ? "invisible" : ""}>
                  <Chevron up />
                </ActionButton>
                <ActionButton
                  action={moveItemAction.bind(null, type, item.id, "down")}
                  label={`Move ${item.title} down`}
                  className={i === items.length - 1 ? "invisible" : ""}
                >
                  <Chevron />
                </ActionButton>
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/${section}/${item.id}`} className="block truncate text-[15px] font-medium text-strong underline-offset-4 hover:underline">
                  {item.title}
                </Link>
                <span className="text-[13px]">
                  {item.note}
                  {item.featured ? ", on the About page" : ""}
                </span>
              </div>
              <Link href={`/admin/${section}/${item.id}`} className="text-[14px] transition-colors hover:text-strong">
                Edit
              </Link>
              <ActionButton
                action={deleteItemAction.bind(null, type, item.id)}
                confirm={`Delete "${item.title}"? This cannot be undone.`}
                className="text-[14px]"
              >
                Delete
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? "M4 8l4-4 4 4" : "M4 4l4 4 4-4"} />
    </svg>
  );
}
