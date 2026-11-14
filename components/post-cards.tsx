"use client";

/* eslint-disable @next/next/no-img-element */
import { ArrowUpRight, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlatformIcon, platformFor } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { postWhere } from "@/lib/content";
import type { Post } from "@/lib/types";

// The Content page cards: a 16:9 thumbnail with the platform and length on it, then the title,
// summary, kind and date. Clicking a card opens a detail popup. The address follows the open
// card (/content#id), so a link to a card opens it, including the agent's source chips.

const tint = (hue: string, amount: number) => `color-mix(in srgb, ${hue} ${amount}%, var(--raise))`;

/** Uploaded thumbnail, or one drawn from the title in the platform's colour. */
function Thumbnail({ post, large = false }: { post: Post; large?: boolean }) {
  const { platform, length } = postWhere(post);
  const { hue } = platformFor(platform, post.kind);
  const label = platform || post.kind;

  return (
    <span className="@container relative block aspect-video overflow-hidden rounded-[10px] bg-chip">
      {post.thumbnail ? (
        post.thumbnail.startsWith("/") ? (
          <Image
            src={post.thumbnail}
            alt=""
            fill
            sizes={large ? "560px" : "(min-width: 640px) 340px, 100vw"}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <img
            src={post.thumbnail}
            alt=""
            className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        )
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          style={{ background: `linear-gradient(135deg, ${tint(hue, 26)}, ${tint(hue, 7)} 70%)` }}
        >
          {/* A faint dot grid that fades toward the title. */}
          <span
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(${tint(hue, 45)} 1px, transparent 1.2px)`,
              backgroundSize: "14px 14px",
              maskImage: "linear-gradient(to bottom right, black, transparent 75%)",
            }}
          />
          <PlatformIcon
            platform={platform}
            kind={post.kind}
            className="absolute -right-[4cqw] -bottom-[6cqw] size-[38cqw] rotate-[-8deg] text-strong opacity-[0.06]"
          />
          <span
            className={`absolute right-[27%] bottom-[7cqw] left-[6cqw] line-clamp-3 font-medium leading-[1.15] tracking-[-0.02em] text-strong ${
              large ? "text-[5.4cqw]" : "text-[6.4cqw]"
            }`}
          >
            {post.title}
          </span>
        </span>
      )}

      {label && (
        <span className="absolute top-[3.5cqw] left-[3.5cqw] inline-flex items-center gap-1.5 rounded-full bg-raise/90 py-[3px] pr-2.5 pl-2 text-[11.5px] font-medium text-strong shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-black/5 backdrop-blur-sm">
          <PlatformIcon platform={platform} kind={post.kind} className="size-3" />
          {label}
        </span>
      )}
      {length && (
        <span className="absolute right-[3.5cqw] bottom-[3.5cqw] rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur-sm">
          {length}
        </span>
      )}
    </span>
  );
}

function verbFor(kind: string) {
  const k = kind.toLowerCase();
  if (["video", "short", "talk", "live", "stream"].includes(k)) return "Watch";
  if (["podcast", "episode"].includes(k)) return "Listen";
  if (k === "newsletter") return "Subscribe";
  return "Read";
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-line px-2 py-0.5 font-mono text-[12px] text-soft">{children}</span>;
}

/** Content cards in a grid. `compact` fits three across, for the About page. */
export function PostCards({ posts, compact = false }: { posts: Post[]; compact?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const post = posts.find((p) => p.id === openId) ?? null;

  const open = useCallback((id: string) => {
    setOpenId(id);
    history.replaceState(history.state, "", `#${id}`);
  }, []);
  const close = useCallback(() => dialogRef.current?.close(), []);

  // Open the card named in the address on arrival and when the hash changes.
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (posts.some((p) => p.id === id)) setOpenId(id);
    };
    const first = setTimeout(fromHash, 0);
    window.addEventListener("hashchange", fromHash);
    return () => {
      clearTimeout(first);
      window.removeEventListener("hashchange", fromHash);
    };
  }, [posts]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && post && !dialog.open) dialog.showModal();
  }, [post]);

  const onClosed = () => {
    setOpenId(null);
    history.replaceState(history.state, "", location.pathname + location.search);
  };

  const where = post ? postWhere(post) : null;

  return (
    <>
      <ul className={`grid gap-4 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {posts.map((item) => {
          const { date } = item;
          return (
            <li key={item.id} id={compact ? undefined : item.id}>
              <button
                type="button"
                onClick={() => open(item.id)}
                aria-haspopup="dialog"
                className="group flex h-full w-full cursor-pointer flex-col rounded-[14px] border border-dashed border-dash bg-raise/40 p-1.5 text-left transition-[border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-soft hover:shadow-[0_12px_32px_-14px_rgb(0_0_0/0.22)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-soft"
              >
                <Thumbnail post={item} />
                <span className={`flex flex-1 flex-col ${compact ? "px-2 pt-2.5 pb-2" : "px-2.5 pt-3 pb-2.5"}`}>
                  <span className={`line-clamp-2 font-medium leading-snug text-strong ${compact ? "text-[14px]" : "text-[15px]"}`}>
                    {item.title}
                  </span>
                  <span className={`mt-1 line-clamp-2 leading-[1.5] ${compact ? "text-[12.5px]" : "text-[13.5px]"}`}>{item.summary}</span>
                  <span className="mt-auto flex items-center justify-between gap-2 pt-3 font-mono text-[12px] text-soft">
                    <span>{item.kind.toLowerCase()}</span>
                    {date && <span>{date}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={onClosed}
        onClick={(event) => {
          // A click on the backdrop lands on the dialog element itself.
          if (event.target === event.currentTarget) close();
        }}
        aria-labelledby="post-dialog-title"
        className="post-dialog m-auto max-h-[calc(100dvh-2rem)] w-[min(560px,calc(100%-2rem))] overflow-y-auto overscroll-contain rounded-[20px] border border-line bg-bg p-0 text-body shadow-[0_30px_90px_-24px_rgb(0_0_0/0.45)] backdrop:bg-black/45 backdrop:backdrop-blur-[3px]"
      >
        {post && where && (
          <div className="relative">
            <div className="p-2">
              <Thumbnail post={post} large />
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute top-4 right-4 grid size-8 cursor-pointer place-items-center rounded-full bg-raise/90 text-strong shadow-[0_1px_3px_rgb(0_0_0/0.15)] ring-1 ring-black/5 backdrop-blur-sm transition-colors hover:bg-raise"
            >
              <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>

            <div className="px-6 pt-3 pb-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip>{post.kind.toLowerCase()}</Chip>
                {where.length && <Chip>{where.length}</Chip>}
                {post.date && <Chip>{post.date}</Chip>}
              </div>
              <h2 id="post-dialog-title" className="mt-3 text-[22px] leading-tight font-medium tracking-[-0.015em] text-strong">
                {post.title}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed">{post.summary}</p>
              {post.details && (
                <div className="mt-4 text-[14.5px] leading-relaxed">
                  <Markdown>{post.details}</Markdown>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-dashed border-dash pt-5">
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-strong py-2 pr-3.5 pl-4 text-[13.5px] font-medium text-bg transition-opacity hover:opacity-85"
                >
                  <PlatformIcon platform={where.platform} kind={post.kind} className="size-3.5" />
                  {verbFor(post.kind)}
                  {where.platform ? ` on ${where.platform}` : ""}
                  <ArrowUpRight className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                </a>
                <button type="button" onClick={close} className="cursor-pointer text-[13.5px] text-soft transition-colors hover:text-strong">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
