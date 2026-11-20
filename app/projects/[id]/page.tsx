/* eslint-disable @next/next/no-img-element */
import { ArrowLeft, ArrowRight, ArrowUpRight, CircleCheck, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GitHubIcon } from "@/components/icons";
import { Page } from "@/components/lists";
import { Markdown } from "@/components/markdown";
import { ProjectPreview } from "@/components/project-preview";
import { videoSource } from "@/lib/media";
import { getProjects } from "@/lib/store";
import type { Project, ProjectMedia } from "@/lib/types";

// One page per project, opened from its card. Projects added in the admin after a build are rendered
// on their first visit and then served from the cache, like the rest of the site's content.

export async function generateStaticParams() {
  const projects = await getProjects();
  return projects.map((project) => ({ id: project.id }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await params;
  const project = (await getProjects()).find((p) => p.id === id);
  return project ? { title: project.title, description: project.description } : { title: "Project" };
}

const FRAME = "rounded-[14px] border border-dashed border-dash p-[9px]";
const MONO = "font-mono text-[12.5px] text-soft";

export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <Page>
      <Link href="/projects" className="mb-10 inline-flex items-center gap-1.5 text-[14px] transition-colors hover:text-accent">
        <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
        All projects
      </Link>
      {/* The id is read inside the boundary, so projects that are not in the build still get the page's shell at once. */}
      <Suspense fallback={<div className="h-[520px]" aria-hidden="true" />}>
        <ProjectDetail params={params} />
      </Suspense>
    </Page>
  );
}

async function ProjectDetail({ params }: { params: PageProps<"/projects/[id]">["params"] }) {
  const { id } = await params;
  const projects = await getProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index < 0) notFound();
  const project = projects[index];
  const done = project.status === "completed";
  const media = project.media ?? [];
  const others = [projects[index - 1], projects[index + 1]].filter((p): p is Project => Boolean(p));

  return (
    <article>
      <header className="mb-10">
        <p className={`mb-4 ${MONO}`}>
          {project.category} · {project.date}
        </p>
        <h1 className="mb-4 text-[40px] font-medium leading-[1.05] tracking-[-0.035em] text-strong sm:text-[52px]">{project.title}</h1>
        <p className="max-w-[600px] text-[18px] leading-[1.55]">{project.description}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="flex items-center gap-1.5 text-[13.5px] text-strong">
            {done ? (
              <CircleCheck className="size-4 text-ok" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Clock className="size-4 text-warn" strokeWidth={1.5} aria-hidden="true" />
            )}
            {done ? "Completed" : "In progress"}
          </span>
          {project.links.live && (
            <a href={project.links.live} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13.5px] text-strong transition-colors hover:border-accent hover:text-accent">
              Live link <ArrowUpRight className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
            </a>
          )}
          {project.links.github && (
            <a href={project.links.github} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13.5px] text-strong transition-colors hover:border-accent hover:text-accent">
              GitHub <GitHubIcon className="size-3.5" />
            </a>
          )}
        </div>
      </header>

      <div className={`mb-12 ${FRAME}`}>
        {/* The animated previews are laid out for a card about 320px wide. On wide screens the card-size
            preview is scaled up to fill the column, so it reads as the same picture, only larger. */}
        <div className="md:hidden">
          <ProjectPreview project={project} className="rounded-[8px]" />
        </div>
        <div className="hidden aspect-[16/10.4] overflow-hidden rounded-[8px] md:block">
          <div className="w-[320px] origin-top-left scale-[2.044]">
            <ProjectPreview project={project} className="" />
          </div>
        </div>
      </div>

      {project.details && (
        <section className="mb-12 max-w-[620px] text-[17px] leading-[1.7]">
          <Markdown long>{project.details}</Markdown>
        </section>
      )}

      {media.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-5 text-[22px] font-medium tracking-[-0.02em] text-strong">Pictures and videos</h2>
          <div className="space-y-6">
            {media.map((item, i) => (
              <MediaFigure key={`${item.src}-${i}`} item={item} title={project.title} />
            ))}
          </div>
        </section>
      )}

      {project.stack.length > 0 && (
        <section className="mb-12">
          <h2 className={`mb-3 ${MONO}`}>Built with</h2>
          <ul className="flex flex-wrap gap-[6px]">
            {project.stack.map((tech) => (
              <li key={tech} className="rounded-[6px] border border-line px-2 py-0.5 text-[13px] text-strong">
                {tech}
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <nav aria-label="More projects" className="grid gap-3 border-t border-dashed border-dash pt-8 sm:grid-cols-2">
          {others.map((other) => {
            const previous = other === projects[index - 1];
            return (
              <Link
                key={other.id}
                href={`/projects/${other.id}`}
                className={`group rounded-[14px] border border-dashed border-dash px-4 py-3.5 transition-colors hover:border-accent ${previous ? "" : "sm:col-start-2 sm:text-right"}`}
              >
                <span className={`flex items-center gap-1 ${MONO} ${previous ? "" : "sm:justify-end"}`}>
                  {previous && <ArrowLeft className="size-3.5" strokeWidth={1.5} aria-hidden="true" />}
                  {previous ? "Previous" : "Next"}
                  {!previous && <ArrowRight className="size-3.5" strokeWidth={1.5} aria-hidden="true" />}
                </span>
                <span className="mt-1 block text-[16px] font-medium text-strong transition-colors group-hover:text-accent">{other.title}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </article>
  );
}

function MediaFigure({ item, title }: { item: ProjectMedia; title: string }) {
  const label = item.caption || `${title}, ${item.kind}`;
  let body: React.ReactNode;
  if (item.kind === "image") {
    body = (
      <a href={item.src} target="_blank" rel="noreferrer" aria-label={`Open full size: ${label}`}>
        <img src={item.src} alt={item.caption ?? ""} loading="lazy" className="block w-full rounded-[8px] bg-chip" />
      </a>
    );
  } else {
    const video = videoSource(item.src);
    body =
      video.type === "embed" ? (
        <iframe
          src={video.src}
          title={label}
          loading="lazy"
          allow="fullscreen; picture-in-picture; encrypted-media"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          referrerPolicy="strict-origin-when-cross-origin"
          className="block aspect-video w-full rounded-[8px] bg-chip"
        />
      ) : video.type === "file" ? (
        <video src={video.src} controls playsInline preload="metadata" className="block w-full rounded-[8px] bg-chip" aria-label={label} />
      ) : (
        <a href={video.src} target="_blank" rel="noreferrer" className="flex aspect-video w-full items-center justify-center gap-1.5 rounded-[8px] bg-chip text-[14px] text-strong hover:text-accent">
          Watch the video <ArrowUpRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </a>
      );
  }
  return (
    <figure className={FRAME}>
      {body}
      {item.caption && <figcaption className={`px-1 pb-0.5 pt-2.5 ${MONO}`}>{item.caption}</figcaption>}
    </figure>
  );
}
