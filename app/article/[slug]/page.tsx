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
  const reviewScores = article?.review?.scoring
    ? compactScoreEntries([
        ["AI PM relevance", article.review.scoring.ai_pm_relevance],
        ["HK relevance", article.review.scoring.hk_relevance],
        ["Actionability", article.review.scoring.actionability],
        ["Technical depth", article.review.scoring.technical_depth],
        ["Portfolio value", article.review.scoring.portfolio_value],
      ])
    : [];

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
              {article.review?.status ? (
                <span className="review-pill">
                  Review {formatReviewStatus(article.review.status)}
                </span>
              ) : null}
            </div>
            <h1>{article.question_title}</h1>
            <p className="muted">
              {article.source_name} · {formatDateTime(article.published_at)}
            </p>
            <p className="lead">{article.summary}</p>
            <div className="score-grid" aria-label="Core article scores">
              <ScoreBadge label="Impact" value={article.impact_score} />
              <ScoreBadge label="Relevance" value={article.relevance_score} />
              <ScoreBadge label="Trust" value={article.trust_score} />
            </div>
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

          {reviewScores.length > 0 || article.review?.review_notes ? (
            <section className="info-panel">
              <h2>Review metadata</h2>
              {reviewScores.length > 0 ? (
                <div className="score-grid" aria-label="Review scoring dimensions">
                  {reviewScores.map(([label, value]) => (
                    <ScoreBadge key={label} label={label} value={value} />
                  ))}
                </div>
              ) : null}
              {article.review?.review_notes ? <p>{article.review.review_notes}</p> : null}
            </section>
          ) : null}
        </article>
      </main>
    </>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="mini-score">
      <strong>{label}</strong>
      <span>{value}/10</span>
    </span>
  );
}

function formatReviewStatus(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function compactScoreEntries(
  entries: Array<readonly [string, number | undefined]>,
): Array<readonly [string, number]> {
  return entries.filter((entry): entry is readonly [string, number] => {
    return typeof entry[1] === "number";
  });
}
