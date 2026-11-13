import Link from "next/link";
import type { Project } from "@/lib/types";
import { GitHubIcon } from "./icons";
import { ProjectPreview } from "./project-preview";

export function ProjectCard({ project }: { project: Project }) {
  const done = project.status === "completed";
  const actions = [
    project.links.live && { label: "Live link", href: project.links.live, icon: <ArrowIcon /> },
    project.links.github && { label: "GitHub", href: project.links.github, icon: <GitHubIcon className="size-3.5" /> },
  ].filter((a): a is { label: string; href: string; icon: React.JSX.Element } => Boolean(a));

  return (
    // The title's link covers the whole card, so a click anywhere opens the project's page; the footer links sit above it.
    <article id={project.id} className="group relative flex min-w-0 flex-col rounded-[14px] border border-dashed border-dash px-[9px] pt-[9px] transition-colors hover:border-soft">
      <ProjectPreview project={project} />
      <div className="flex flex-1 flex-col px-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-strong">
            <Link href={`/projects/${project.id}`} className="transition-colors after:absolute after:inset-0 after:rounded-[14px] after:content-[''] group-hover:text-accent">
              {project.title}
            </Link>
          </h3>
          <span className="whitespace-nowrap text-[11.5px] text-strong">{project.date}</span>
        </div>
        <p className="mb-[7px] mt-px flex items-center gap-1.5 text-[12.5px] text-strong">
          <span className={done ? "text-ok" : "text-warn"}>{done ? <CheckIcon /> : <ClockIcon />}</span>
          {done ? "Completed" : "In progress"}
        </p>
        <p className="mb-2.5 text-[13.5px] leading-[1.55]">{project.description}</p>
        <ul className="mb-3.5 flex flex-wrap gap-[5px]">
          {project.stack.map((tech) => (
            <li key={tech} className="rounded-[5px] border border-line px-[7px] py-px text-[11.5px] text-strong">
              {tech}
            </li>
          ))}
        </ul>
      </div>
      {actions.length > 0 && (
        <div className="relative z-10 -mx-[9px] mt-auto flex border-t border-dashed border-dash">
          {actions.map((action, i) => (
            <a
              key={action.label}
              href={action.href}
              className={`relative flex flex-1 items-center justify-center gap-[7px] px-2 py-2.5 text-[13px] transition-colors hover:text-accent ${
                i > 0 ? "before:absolute before:inset-y-[9px] before:left-0 before:border-l before:border-dashed before:border-dash" : ""
              }`}
            >
              {action.label} {action.icon}
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.3" />
      <path d="M5.3 8.2l1.9 1.9 3.6-4" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.3" />
      <path d="M8 4.6V8l2.2 1.5" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 8l6-6M3.5 2H8v4.5" />
    </svg>
  );
}
