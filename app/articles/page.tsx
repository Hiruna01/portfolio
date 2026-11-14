import type { Metadata } from "next";
import { ArticleRows, Page, PageTitle } from "@/components/lists";
import { getArticles } from "@/lib/store";

export const metadata: Metadata = { title: "Articles" };

export default async function ArticlesPage() {
  const articles = await getArticles();
  return (
    <Page>
      <PageTitle title="Articles" lede="Written pieces and technical explainers on agents, retrieval and evaluation." />
      <ArticleRows articles={articles} />
    </Page>
  );
}
