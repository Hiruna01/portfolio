import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Header } from "@/components/header";
import { InlineScript } from "@/components/inline-script";
import { PondBackground } from "@/components/pond-background";
import { getProfile } from "@/lib/store";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getProfile();
  return {
    title: { default: `${profile.name}, AI engineer`, template: `%s | ${profile.name}` },
    description: `Ask ${profile.name}'s agent about projects, articles and content, or browse them yourself.`,
  };
}

// Runs before first paint so a saved dark theme does not flash light.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <InlineScript html={themeScript} />
      </head>
      <body className="font-sans">
        {/* Like the header, the pond reads the current path (it is left out of the admin area). */}
        <Suspense fallback={null}>
          <PondBackground />
        </Suspense>
        {/* The header reads the current path, which is only known per request on dynamic routes. */}
        <Suspense fallback={<div className="h-[60px]" />}>
          <Header />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
