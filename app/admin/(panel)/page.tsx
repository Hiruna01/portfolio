import Link from "next/link";
import { ActionButton } from "@/components/admin/buttons";
import { requireAdmin } from "@/lib/auth";
import { readAgentSettings, readArticles, readPosts, readProjects, recentActivity } from "@/lib/store";
import { logoutEverywhereAction } from "../actions";

// Moving between admin pages is not instant either: each page checks the session first (see the panel layout).
export const instant = false;

export default async function AdminHome() {
  await requireAdmin();
  const [projects, articles, posts, agent, activity] = await Promise.all([
    readProjects(),
    readArticles(),
    readPosts(),
    readAgentSettings(),
    recentActivity(),
  ]);

  const tiles = [
    { href: "/admin/projects", label: "Projects", value: String(projects.length) },
    { href: "/admin/articles", label: "Articles", value: String(articles.length) },
    { href: "/admin/content", label: "Content", value: String(posts.length) },
    { href: "/admin/agent", label: "Agent", value: agent.enabled ? "On" : "Off" },
  ];

  return (
    <>
      <h1 className="mb-6 text-[24px] font-medium tracking-[-0.015em] text-strong">Overview</h1>
      <ul className="mb-12 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.href}>
            <Link href={tile.href} className="block rounded-[12px] border border-dashed border-dash px-4 py-3 transition-colors hover:border-soft">
              <span className="block text-[22px] font-medium text-strong">{tile.value}</span>
              <span className="text-[13.5px]">{tile.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mb-3 text-[17px] font-medium text-strong">Recent activity</h2>
      {activity.length === 0 ? (
        <p className="text-[14.5px]">Nothing yet. Changes you make will be listed here.</p>
      ) : (
        <ul className="border-t border-dashed border-dash text-[14px]">
          {activity.map((entry, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-4 border-b border-dashed border-dash py-2">
              <time dateTime={entry.at} className="w-[150px] shrink-0 font-mono text-[12px] text-soft">
                {entry.at.slice(0, 16).replace("T", " ")} UTC
              </time>
              <span className="text-strong">{entry.action}</span>
              <span>{entry.detail}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 mt-12 text-[17px] font-medium text-strong">Sessions</h2>
      <p className="mb-3 max-w-[520px] text-[14.5px]">
        A sign-in lasts 8 hours. If you signed in on a device you no longer trust, this ends every session, including this one.
      </p>
      <ActionButton
        action={logoutEverywhereAction}
        confirm="Sign out on every device, including this one?"
        className="rounded-lg border border-line px-3.5 py-2 text-[14px] text-strong hover:border-soft"
      >
        Sign out everywhere
      </ActionButton>
    </>
  );
}
