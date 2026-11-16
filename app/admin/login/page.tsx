import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/buttons";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[380px] flex-col justify-center px-6 pb-[10vh]">
      <h1 className="mb-1 text-[24px] font-medium tracking-[-0.015em] text-strong">Admin</h1>
      <p className="mb-7 text-[15px]">Sign in to edit the site.</p>
      <LoginForm action={loginAction} />
    </main>
  );
}
