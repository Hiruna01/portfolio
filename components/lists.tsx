import Link from "next/link";
import { getProfile } from "@/lib/store";
import type { Article } from "@/lib/types";

const FOOT_LINK = "underline decoration-line underline-offset-4 transition-colors hover:text-accent hover:decoration-accent";

/** Page wrapper for the browse pages: one narrow column, closed by the contact footer. */
export async function Page({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  return (
    <main className="mx-auto max-w-[720px] px-6 pb-14 pt-12">
      {children}
      <footer className="mt-24 flex flex-wrap items-end justify-between gap-x-10 gap-y-6 border-t border-dashed border-dash pt-8">
        <div>
          <p className="text-[17px] font-medium tracking-[-0.01em] text-strong">{profile.name}</p>
          <p className="text-[14px]">{profile.tagline}</p>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
          <li>
            <a href={`mailto:${profile.email}`} className={FOOT_LINK}>
              {profile.email}
            </a>
          </li>
          {profile.links.map((link) => (
            <li key={link.label}>
              <a href={link.url} target="_blank" rel="noreferrer" className={FOOT_LINK}>
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <Link href="/" className={FOOT_LINK}>
              Ask the agent instead
            </Link>
          </li>
        </ul>
      </footer>
    </main>
  );
}

export function PageTitle({ title, lede }: { title: string; lede: string }) {
  return (
    <header className="mb-12 pt-4">
      <h1 className="mb-4 text-[40px] font-medium leading-[1.05] tracking-[-0.035em] text-strong sm:text-[52px]">{title}</h1>
      <p className="max-w-[560px] text-[18px] leading-[1.55]">{lede}</p>
    </header>
  );
}

export function SectionHead({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-4">
      <h2 className="text-[22px] font-medium tracking-[-0.02em] text-strong">{title}</h2>
      {href && linkLabel && (
        <Link href={href} className="text-[13.5px] underline decoration-line underline-offset-4 transition-colors hover:text-accent hover:decoration-accent">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export function ArticleRows({ articles }: { articles: Article[] }) {
  return (
    <ul className="border-t border-dashed border-dash">
      {articles.map((article) => (
        <li key={article.id} id={article.id} className="border-b border-dashed border-dash">
          <a href={article.url} className="group grid grid-cols-[minmax(0,1fr)_auto] gap-x-[18px] gap-y-0.5 py-4 sm:grid-cols-[84px_minmax(0,1fr)_auto] sm:items-baseline">
            <span className="col-span-2 font-mono text-[12.5px] sm:col-span-1">{article.date}</span>
            <span>
              <span className="block text-[17px] font-medium leading-snug tracking-[-0.01em] text-strong transition-colors group-hover:text-accent">{article.title}</span>
              <span className="mt-0.5 block text-[14px] leading-[1.5]">{article.summary}</span>
            </span>
            <span className="font-mono text-[12.5px]">{article.readingTime}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
