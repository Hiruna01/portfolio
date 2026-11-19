import { ArrowUpRight, CircleCheck, Clock } from "lucide-react";
import Link from "next/link";
import type { Project, UiBlock } from "@/lib/types";
import { CopyEmail } from "./copy-email";
import { postWhere } from "@/lib/content";
import { GitHubIcon, PlatformIcon, SocialIcon } from "./icons";
import { ProjectPreview } from "./project-preview";

// What the agent shows under an answer. The browse pages use large cards; in a conversation those
// are too heavy, so everything here is one compact list in a single outlined box. Every row uses
// the same three columns (lead, body, trailing detail), so projects, articles and content line up.

// Tools can finish in any order, so results are always laid out in this one.
const ORDER = ["projects", "articles", "content", "contact"];

const ROW = "relative grid grid-cols-[76px_minmax(0,1fr)] gap-x-3.5 px-3.5 py-3 transition-colors sm:grid-cols-[96px_minmax(0,1fr)_auto]";
const LEAD = "pt-0.5 font-mono text-[11.5px] leading-5 text-soft";
const TITLE = "text-[14.5px] font-medium leading-5 text-strong";
const SUMMARY = "mt-0.5 line-clamp-2 text-[13px] leading-[1.45]";
const TRAIL = "hidden pt-0.5 text-right font-mono text-[11.5px] leading-5 text-soft sm:block";
/** Makes the whole row clickable from one link, while other links in the row stay usable. */
const COVER = "after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-4";

export function ChatResults({ blocks }: { blocks: UiBlock[] }) {
  if (!blocks.length) return null;
  const sorted = [...blocks].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  return (
    <ul className="divide-y divide-dashed divide-dash overflow-hidden rounded-[14px] border border-dashed border-dash bg-bg/80 backdrop-blur-sm">
      {sorted.flatMap((block, b) => {
        if (block.kind === "projects") return block.items.map((project) => <ProjectRow key={`${b}-${project.id}`} project={project} />);

        if (block.kind === "articles") {
          return block.items.map((article) => (
            <li key={`${b}-${article.id}`} className={`${ROW} hover:bg-chip/60`}>
              <span className={LEAD}>{article.date}</span>
              <div className="min-w-0">
                <a href={article.url} className={`${TITLE} ${COVER}`}>
                  {article.title}
                </a>
                <p className={SUMMARY}>{article.summary}</p>
              </div>
              <span className={TRAIL}>{article.readingTime}</span>
            </li>
          ));
        }

        if (block.kind === "content") {
          return block.items.map((post) => {
            const { platform, length } = postWhere(post);
            return (
              <li key={`${b}-${post.id}`} className={`${ROW} hover:bg-chip/60`}>
                <span className={LEAD}>{post.kind.toLowerCase()}</span>
                <div className="min-w-0">
                  <a href={post.url} className={`${TITLE} ${COVER}`}>
                    {post.title}
                  </a>
                  <p className={SUMMARY}>{post.summary}</p>
                </div>
                <span className={TRAIL}>
                  <span className="inline-flex items-center gap-1.5">
                    <PlatformIcon platform={platform} kind={post.kind} className="size-3" />
                    {length}
                  </span>
                </span>
              </li>
            );
          });
        }

        return [
          <li key={`${b}-contact`} className={ROW}>
            <span className={LEAD}>contact</span>
            <div className="min-w-0 sm:col-span-2">
              <CopyEmail email={block.email} />
              <p className="mt-1 text-[13px] leading-[1.45]">{block.availability}</p>
              {block.links.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {block.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[12.5px] text-strong transition-colors hover:border-soft"
                      >
                        <SocialIcon label={link.label} className="size-3" />
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>,
        ];
      })}
    </ul>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const done = project.status === "completed";
  return (
    <li className={`${ROW} hover:bg-chip/60`}>
      {/* The card's live preview, drawn at full size and scaled down so it stays crisp. */}
      <div className="h-[49px] w-[76px] overflow-hidden rounded-md sm:h-[62px] sm:w-[96px]" aria-hidden="true">
        <div className="w-[304px] origin-top-left scale-[0.25] sm:scale-[0.316]">
          <ProjectPreview project={project} className="" />
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Link href={`/projects/${project.id}`} className={`${TITLE} ${COVER}`}>
            {project.title}
          </Link>
          {done ? (
            <CircleCheck className="size-3.5 shrink-0 text-ok" strokeWidth={1.75} aria-label="Completed" />
          ) : (
            <Clock className="size-3.5 shrink-0 text-warn" strokeWidth={1.75} aria-label="In progress" />
          )}
        </div>
        <p className={SUMMARY}>{project.description}</p>
        <p className="mt-1 truncate font-mono text-[11.5px] text-soft">{project.stack.join(", ")}</p>
      </div>

      <div className="hidden flex-col items-end justify-between sm:flex">
        <span className="pt-0.5 font-mono text-[11.5px] leading-5 text-soft">{project.date}</span>
        <div className="relative z-10 flex items-center gap-0.5 text-soft">
          {project.links.live && (
            <a href={project.links.live} aria-label={`${project.title} live link`} className="grid size-7 place-items-center rounded-md transition-colors hover:bg-chip hover:text-strong">
              <ArrowUpRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
            </a>
          )}
          {project.links.github && (
            <a href={project.links.github} aria-label={`${project.title} on GitHub`} className="grid size-7 place-items-center rounded-md transition-colors hover:bg-chip hover:text-strong">
              <GitHubIcon className="size-3.5" />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
