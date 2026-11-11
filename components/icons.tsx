import { Globe, Mail, Mic, PenLine, Play, Presentation, type LucideIcon } from "lucide-react";

type IconProps = { className?: string };

// lucide (the icon set shadcn/ui uses) no longer ships brand logos, so these are inline SVGs.
export function GitHubIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 .9a7.1 7.1 0 0 0-2.25 13.84c.36.07.49-.15.49-.34v-1.2c-1.98.43-2.4-.95-2.4-.95-.32-.82-.79-1.04-.79-1.04-.65-.44.05-.43.05-.43.71.05 1.09.73 1.09.73.63 1.09 1.66.77 2.07.59.06-.46.25-.77.45-.95-1.58-.18-3.24-.79-3.24-3.51 0-.78.28-1.41.73-1.91-.07-.18-.32-.9.07-1.88 0 0 .6-.19 1.95.73a6.8 6.8 0 0 1 3.56 0c1.36-.92 1.95-.73 1.95-.73.39.98.14 1.7.07 1.88.46.5.73 1.13.73 1.91 0 2.73-1.66 3.33-3.25 3.5.26.22.48.65.48 1.32v1.95c0 .19.13.41.49.34A7.1 7.1 0 0 0 8 .9z" />
    </svg>
  );
}

export function LinkedInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.41z" />
    </svg>
  );
}

export function YouTubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
    </svg>
  );
}

export function SubstackIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M22.54 8.24H1.46V5.41h21.08v2.83zM1.46 10.81V24L12 18.11 22.54 24V10.81H1.46zM22.54 0H1.46v2.84h21.08V0z" />
    </svg>
  );
}

const brands: Record<string, (props: IconProps) => React.JSX.Element> = {
  github: GitHubIcon,
  linkedin: LinkedInIcon,
  x: XIcon,
  twitter: XIcon,
};

/** Icon for a social link, picked by its label. Unknown labels get a globe. */
export function SocialIcon({ label, className }: { label: string; className?: string }) {
  const Brand = brands[label.toLowerCase()];
  if (Brand) return <Brand className={className} />;
  const Fallback: LucideIcon = Globe;
  return <Fallback aria-hidden="true" className={className} strokeWidth={1.5} />;
}

// ---------- Content platforms ----------

type Platform = { icon: (props: IconProps) => React.JSX.Element; hue: string };

const lucide = (Icon: LucideIcon) =>
  function PlatformGlyph({ className }: IconProps) {
    return <Icon aria-hidden="true" className={className} strokeWidth={1.75} />;
  };

// Keyed by platform name, then by content kind as a fallback. The hue tints generated thumbnails.
const PLATFORMS: Record<string, Platform> = {
  youtube: { icon: YouTubeIcon, hue: "#e5484d" },
  x: { icon: XIcon, hue: "#7d828a" },
  twitter: { icon: XIcon, hue: "#7d828a" },
  linkedin: { icon: LinkedInIcon, hue: "#0a66c2" },
  github: { icon: GitHubIcon, hue: "#6e5494" },
  substack: { icon: SubstackIcon, hue: "#ff6719" },
  newsletter: { icon: lucide(Mail), hue: "#d9a441" },
  podcast: { icon: lucide(Mic), hue: "#8e4ec6" },
  spotify: { icon: lucide(Mic), hue: "#1db954" },
  meetup: { icon: lucide(Presentation), hue: "#12a594" },
  talk: { icon: lucide(Presentation), hue: "#12a594" },
  conference: { icon: lucide(Presentation), hue: "#12a594" },
  blog: { icon: lucide(PenLine), hue: "#5b6b8c" },
  medium: { icon: lucide(PenLine), hue: "#5b6b8c" },
  video: { icon: lucide(Play), hue: "#e5484d" },
  short: { icon: lucide(Play), hue: "#e5484d" },
};

const FALLBACK: Platform = { icon: lucide(Globe), hue: "#5b6b8c" };

/** Icon and tint for where a post was published, falling back to its kind, then to a globe. */
export function platformFor(platform: string, kind = ""): Platform {
  return PLATFORMS[platform.trim().toLowerCase()] ?? PLATFORMS[kind.trim().toLowerCase()] ?? FALLBACK;
}

export function PlatformIcon({ platform, kind, className }: { platform: string; kind?: string; className?: string }) {
  const { icon: Icon } = platformFor(platform, kind);
  return <Icon className={className} />;
}
