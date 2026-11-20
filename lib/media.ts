// Turns the addresses saved for a project's pictures and videos into something a page can show.
// Only YouTube and Vimeo are embedded; the content security policy in next.config.ts allows frames from those two hosts only.

const VIDEO_FILE = /\.(mp4|webm|mov)(\?.*)?$/i;
const ID = /^[A-Za-z0-9_-]{4,40}$/;

export type VideoSource = { type: "embed"; src: string } | { type: "file"; src: string } | { type: "link"; src: string };

function parse(address: string): URL | null {
  try {
    return new URL(address, "https://placeholder.invalid");
  } catch {
    return null;
  }
}

/** YouTube or Vimeo page address to its privacy-friendly player address, or null. */
function embedFor(address: string): string | null {
  const url = parse(address);
  if (!url || url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^(www|m)\./, "");
  let id: string | null = null;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? null;
    if (id && ID.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0];
    if (ID.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    id = url.pathname.match(/(\d{5,12})/)?.[1] ?? null;
    if (id) return `https://player.vimeo.com/video/${id}?dnt=1`;
  }
  return null;
}

/** True when an address saved in the admin should be treated as a video rather than an image. */
export function isVideoAddress(address: string): boolean {
  return embedFor(address) !== null || VIDEO_FILE.test(address);
}

/** How a saved video should play: an embedded player, the browser's own video player, or (anything else) a plain link. */
export function videoSource(address: string): VideoSource {
  const embed = embedFor(address);
  if (embed) return { type: "embed", src: embed };
  if (VIDEO_FILE.test(address)) return { type: "file", src: address };
  return { type: "link", src: address };
}
