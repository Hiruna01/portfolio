import type { Article, Item, Post, Project } from "./types";

// Short, uniform descriptions of saved records, used for search results and source cards in the chat.

export const projectItem = (p: Project): Item => ({
  type: "project",
  kind: "project",
  id: p.id,
  title: p.title,
  summary: p.description,
  href: `/projects/${p.id}`,
});

export const articleItem = (a: Article): Item => ({
  type: "article",
  kind: "article",
  id: a.id,
  title: a.title,
  summary: a.summary,
  href: `/articles#${a.id}`,
});

export const postItem = (c: Post): Item => ({
  type: "content",
  kind: c.kind.toLowerCase(),
  id: c.id,
  title: c.title,
  summary: c.summary,
  href: `/content#${c.id}`,
});

/**
 * Where a post was published and how long it is. Posts saved before the platform field existed
 * kept both in `meta` ("YouTube, 21 min"), so that form is split apart here.
 */
export function postWhere(post: Post): { platform: string; length: string } {
  if (post.platform) return { platform: post.platform, length: post.meta };
  const [first, ...rest] = post.meta.split(",");
  return rest.length ? { platform: first.trim(), length: rest.join(",").trim() } : { platform: "", length: post.meta };
}
