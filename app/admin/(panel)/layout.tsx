import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/admin/buttons";
import { logoutAction } from "../actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// Admin pages check the session before rendering anything, so they are never prerendered for instant navigation.
export const instant = false;

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/articles", label: "Articles" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/profile", label: "Profile" },
  { href: "/admin/agent", label: "Agent" },
];

// This layout only draws the frame. It holds no private data: each page checks the session itself.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-dashed border-dash bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-[56px] max-w-[860px] flex-wrap items-center justify-between gap-x-5 gap-y-1 px-6 py-2">
          <nav aria-label="Admin" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-strong">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-[14px]">
            <Link href="/" className="transition-colors hover:text-strong">
              View site
            </Link>
            <ActionButton action={logoutAction}>Sign out</ActionButton>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[860px] px-6 pb-20 pt-10">{children}</main>
    </>
  );
}
