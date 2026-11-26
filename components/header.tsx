"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";
import { LampToggle } from "@/components/lamp-toggle";
import { StarBorder } from "@/components/ui/star-border";

const pages = [
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/articles", label: "Articles" },
  { href: "/content", label: "Content" },
];

function onScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

export function Header({ name }: { name: string }) {
  const pathname = usePathname();
  const scrolled = useSyncExternalStore(onScroll, () => window.scrollY > 4, () => false);
  // On the agent page the header stays clear while the page is at the top, so the background
  // animation runs behind it. Once the chat scrolls, the backing returns so answers don't run
  // under the links.
  const clear = pathname === "/" && !scrolled;

  // The admin area has its own header.
  if (pathname.startsWith("/admin")) return null;

  return (
    <header
      className={`sticky top-0 z-20 transition-[background-color,backdrop-filter] duration-300 ${
        clear ? "bg-transparent" : "bg-bg/85 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-[60px] max-w-[720px] items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
        {/* On a phone the links get smaller and closer, and scroll sideways if they still don't fit. */}
        <nav aria-label="Main" className="-my-2 flex min-w-0 items-center gap-[9px] overflow-x-auto whitespace-nowrap py-2 text-[13px] [scrollbar-width:none] sm:gap-5 sm:text-sm">
          <StarBorder
            as={Link}
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
            theme="auto"
            radius={999}
            duration={5}
            trailLength={0.35}
            glow={0.7}
            color="var(--strong)"
            backgroundColor="var(--raise)"
            textColor="var(--strong)"
            borderColor="var(--line)"
            className="shrink-0 gap-1.5 px-2.5 py-[5px] text-[13px] tracking-[-0.005em] shadow-[0_1px_2px_rgb(0_0_0/0.05)] sm:px-3.5 sm:text-[13.5px]"
          >
            <Sparkles className="hidden size-3.5 text-soft sm:block" strokeWidth={1.75} aria-hidden="true" />
            Ask {name.split(" ")[0]}
          </StarBorder>
          {pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              aria-current={pathname === page.href ? "page" : undefined}
              className={`shrink-0 underline-offset-[7px] transition-colors hover:text-strong ${
                pathname === page.href ? "text-strong underline decoration-accent decoration-2" : ""
              }`}
            >
              {page.label}
            </Link>
          ))}
        </nav>
        <LampToggle />
      </div>
    </header>
  );
}
