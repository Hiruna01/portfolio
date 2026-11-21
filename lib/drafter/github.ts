// Reads a public GitHub repository's details and README for the project drafter.
// Only https://github.com/<owner>/<repo> is accepted, and only api.github.com is ever called,
// so an address typed into the admin cannot point the server anywhere else.

/** A problem worth showing to the admin as it is: a bad link, a missing or private repository, GitHub's rate limit. */
export class GitHubError extends Error {}

export type Repo = {
  owner: string;
  name: string;
  url: string;
  description: string;
  homepage: string;
  topics: string[];
  language: string;
  createdAt: string;
  pushedAt: string;
  archived: boolean;
  readme: string;
};

const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;
const README_LIMIT = 40_000;
const TIMEOUT_MS = 10_000;

/** Pulls owner and repository out of a GitHub link, or throws GitHubError. */
export function parseRepoUrl(input: string): { owner: string; name: string } {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new GitHubError("Paste a full GitHub address, like https://github.com/you/project.");
  }
  if (url.protocol !== "https:" || (url.hostname !== "github.com" && url.hostname !== "www.github.com")) {
    throw new GitHubError("Only https://github.com/<owner>/<repository> links are supported.");
  }
  const [owner, rawName] = url.pathname.split("/").filter(Boolean);
  const name = rawName?.replace(/\.git$/, "");
  if (!owner || !name || !NAME.test(owner) || !NAME.test(name)) {
    throw new GitHubError("That link does not point at a repository. Use https://github.com/<owner>/<repository>.");
  }
  return { owner, name };
}

async function github(path: string, accept: string): Promise<Response> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: accept, "User-Agent": "portfolio-project-drafter", "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch(() => {
    throw new GitHubError("GitHub could not be reached. Try again in a moment.");
  });
  if (response.status === 404) throw new GitHubError("That repository was not found. It may be private; only public repositories are supported.");
  if (response.status === 403 || response.status === 429) throw new GitHubError("GitHub is limiting requests right now. Try again in a few minutes.");
  return response;
}

/**
 * README text with what the drafter should not use taken out: images, badges, HTML picture tags and comments.
 * Links stay, as text. The result is capped, because a README is untrusted input of any size.
 */
export function cleanReadme(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "") // linked badges: [![alt](img)](link)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images: ![alt](src)
    .replace(/<(img|picture|source|video|svg)\b[^>]*\/?>/gi, "")
    .replace(/<\/(picture|video|svg)>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, README_LIMIT);
}

/** Fetches the repository's details and its README. A repository without a README still returns, with an empty one. */
export async function fetchRepo(link: string): Promise<Repo> {
  const { owner, name } = parseRepoUrl(link);
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

  const metaResponse = await github(base, "application/vnd.github+json");
  if (!metaResponse.ok) throw new GitHubError(`GitHub answered with an error (${metaResponse.status}).`);
  const meta = (await metaResponse.json()) as Record<string, unknown>;
  if (meta.private === true) throw new GitHubError("That repository is private; only public repositories are supported.");

  let readme = "";
  try {
    const readmeResponse = await github(`${base}/readme`, "application/vnd.github.raw");
    if (readmeResponse.ok) readme = cleanReadme(await readmeResponse.text());
  } catch (err) {
    // A repository with no README answers 404, which is not a failure here.
    if (!(err instanceof GitHubError) || !err.message.startsWith("That repository was not found")) throw err;
  }

  const str = (value: unknown) => (typeof value === "string" ? value : "");
  const fullName = str(meta.full_name) || `${owner}/${name}`;
  return {
    owner,
    name: str(meta.name) || name,
    url: `https://github.com/${fullName}`,
    description: str(meta.description),
    homepage: str(meta.homepage),
    topics: Array.isArray(meta.topics) ? meta.topics.filter((t): t is string => typeof t === "string") : [],
    language: str(meta.language),
    createdAt: str(meta.created_at),
    pushedAt: str(meta.pushed_at),
    archived: meta.archived === true,
    readme,
  };
}
