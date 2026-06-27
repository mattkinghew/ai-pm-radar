import Link from "next/link";
import { notFound } from "next/navigation";

import { Header } from "@/components/Header";
import { getAllArticles, getArticleBySlug } from "@/lib/articles";
import { formatDate, formatDateTime } from "@/lib/format";

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
      <main className="container section stack-lg">
        <div className="breadcrumb">
          <Link href="/archive">Archive</Link>
          <span>/</span>
          <span>{formatDate(article.date)}</span>
        </div>

        <article className="detail-page">
          <div className="detail-header">
            <div className="meta-row">
              <span className="category-pill">{article.category}</span>
              <span className="score-pill">Score {article.priority_score}</span>
            </div>
            <h1>{article.question_title}</h1>
            <p className="muted">
              {article.source_name} · {formatDateTime(article.published_at)}
            </p>
            <p className="lead">{article.summary}</p>
          </div>

          <div className="grid-two">
            <section className="info-panel">
              <h2>Why it matters</h2>
              <p>{article.why_it_matters}</p>
            </section>
            <section className="info-panel">
              <h2>Business angle</h2>
              <p>{article.business_angle}</p>
            </section>
            <section className="info-panel">
              <h2>AI PM angle</h2>
              <p>{article.ai_pm_angle}</p>
            </section>
            <section className="info-panel">
              <h2>Risk note</h2>
              <p>{article.risk_note}</p>
            </section>
          </div>

          <section className="info-panel">
            <h2>Tags and source</h2>
            <div className="tag-row">
              {article.tags.map((tag) => (
                <span key={tag} className="tag">
                  #{tag}
                </span>
              ))}
            </div>
            <p className="muted">
              Daily file: <strong>{article.date}</strong>
            </p>
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="primary-button"
            >
              Open original source
            </a>
          </section>
        </article>
      </main>
    </>
  );
}
