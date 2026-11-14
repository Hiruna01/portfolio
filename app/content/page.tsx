import type { Metadata } from "next";
import { Page, PageTitle } from "@/components/lists";
import { PostCards } from "@/components/post-cards";
import { getPosts } from "@/lib/store";

export const metadata: Metadata = { title: "Content" };

export default async function ContentPage() {
  const posts = await getPosts();
  return (
    <Page>
      <PageTitle title="Content" lede="Videos, talks, threads and other things I share to teach what I've learned." />
      <PostCards posts={posts} />
    </Page>
  );
}
