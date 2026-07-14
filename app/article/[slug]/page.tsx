import { notFound } from "next/navigation";

import { ArticleDetailContent } from "@/components/ArticleDetailContent";
import { Header } from "@/components/Header";
import { getAllArticles, getArticleBySlug } from "@/lib/articles";

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const articles = await getAllArticles();
  return articles.map((article) => ({
    slug: article.slug,
  }));
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <>
      <Header currentPath="/archive" />
      <ArticleDetailContent article={article} />
    </>
  );
}
