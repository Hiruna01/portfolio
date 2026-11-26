import type { Metadata } from "next";
import Link from "next/link";
import { CopyEmail } from "@/components/copy-email";
import { SocialIcon } from "@/components/icons";
import { ArticleRows, Page, SectionHead } from "@/components/lists";
import { PostCards } from "@/components/post-cards";
import { ProjectCard } from "@/components/project-card";
import { TechText } from "@/components/ui/tech-text";
import { getArticles, getPosts, getProfile, getProjects } from "@/lib/store";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const [profile, projects, articles, posts] = await Promise.all([getProfile(), getProjects(), getArticles(), getPosts()]);
  const featuredProjects = projects.filter((p) => p.featured).slice(0, 2);
  const featuredArticles = articles.filter((a) => a.featured).slice(0, 3);
  const featuredPosts = posts.filter((p) => p.featured).slice(0, 3);

  return (
    <Page>
      <section className="mb-16">
        <div className="mb-[30px]">
          <div className="min-w-0">
            {/* The canvas keeps a 14px side margin for the selection frame; -ml-3.5 lines the letters up with the tagline. */}
            {/* The canvas reads its font from the computed style, so it gets Geist (sans) as loaded by next/font. */}
            <h1 className="-ml-3.5 h-[84px] font-sans text-strong sm:h-[96px]">
              <TechText
                text={profile.name}
                align="left"
                fontSize={56}
                // React Bits' "Vector" settings, with the "type" intro: each letter appears as a dashed
                // outline in the selection frame, then fills in.
                fontWeight={600}
                reveal="letter"
                dashLength={4}
                dashGap={2}
                specks={15}
                intro="type"
                introDuration={2}
                clickKick
                guides={false}
                sweep={false}
              />
            </h1>
            <p className="-mt-2 font-mono text-[13.5px]">{profile.tagline}</p>
          </div>
        </div>
        <div className="max-w-[600px] space-y-5 text-[17px]">
          {profile.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-10">
          <h2 className="mb-2 font-mono text-[12.5px] text-soft">what I can help with</h2>
          <ul className="space-y-1.5 text-[17px] text-strong">
            {profile.focus.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="mt-9">
          <h2 className="mb-2 font-mono text-[12.5px] text-soft">get in touch</h2>
          <p className="mb-2.5 text-[15px]">{profile.availability}</p>
          <CopyEmail email={profile.email} />
          <ul className="mt-4 flex flex-wrap gap-2">
            {profile.links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-[13.5px] text-strong transition-colors hover:border-soft"
                >
                  <SocialIcon label={link.label} className="size-3.5" />
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mb-16">
        <SectionHead title="Featured projects" href="/projects" linkLabel="All projects" />
        <div className="grid gap-[18px] sm:grid-cols-2">
          {featuredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>

      <section className="mb-16">
        <SectionHead title="Recent articles" href="/articles" linkLabel="All articles" />
        <ArticleRows articles={featuredArticles} />
      </section>

      <section>
        <SectionHead title="Videos, talks and posts" href="/content" linkLabel="All content" />
        <PostCards posts={featuredPosts} compact />
      </section>

      <p className="mt-16 rounded-[14px] border border-dashed border-dash px-5 py-4 text-[15px]">
        Looking for something specific?{" "}
        <Link href="/" className="font-medium text-strong underline decoration-line underline-offset-4 transition-colors hover:text-accent hover:decoration-accent">
          Ask my agent
        </Link>{" "}
        and it will find it for you.
      </p>
    </Page>
  );
}
