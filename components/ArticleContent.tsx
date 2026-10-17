"use client";

import Link from "next/link";

import { useLanguage } from "@/components/LanguageProvider";
import type { ArticleRecord } from "@/lib/articles";
import { formatDate, formatDateTime } from "@/lib/format";

export function ArticleContent({ article }: { article: ArticleRecord }) {
  const { locale, messages } = useLanguage();
  const copy = messages.article;
  const reviewScores = article.review?.scoring
    ? compactScoreEntries([
        [copy.aiPmRelevance, article.review.scoring.ai_pm_relevance],
        [copy.hkRelevance, article.review.scoring.hk_relevance],
        [copy.actionability, article.review.scoring.actionability],
        [copy.technicalDepth, article.review.scoring.technical_depth],
        [copy.portfolioValue, article.review.scoring.portfolio_value],
      ])
    : [];

  return (
    <main className="container section stack-lg">
      <div className="breadcrumb">
        <Link href="/archive">{copy.archive}</Link>
        <span>/</span>
        <span>{formatDate(article.date, locale)}</span>
      </div>
      <article className="detail-page">
        <div className="detail-header">
          <div className="meta-row">
            <span className="category-pill">{article.category}</span>
            <span className="score-pill">{copy.score} {article.priority_score}</span>
            {article.review?.status ? (
              <span className="review-pill">{copy.review} {article.review.status === "reviewed" ? copy.reviewed : copy.draft}</span>
            ) : null}
          </div>
          <h1>{article.question_title}</h1>
          <p className="muted">
            {article.source_name} {copy.sourceDateSeparator} {formatDateTime(article.published_at, locale)}
          </p>
          <p className="lead">{article.summary}</p>
          <div className="score-grid" aria-label={copy.coreScores}>
            <ScoreBadge label={copy.impact} value={article.impact_score} />
            <ScoreBadge label={copy.relevance} value={article.relevance_score} />
            <ScoreBadge label={copy.trust} value={article.trust_score} />
          </div>
        </div>

        <div className="grid-two">
          <InfoPanel title={copy.whyItMatters} body={article.why_it_matters} />
          <InfoPanel title={copy.businessAngle} body={article.business_angle} />
          <InfoPanel title={copy.aiPmAngle} body={article.ai_pm_angle} />
          <InfoPanel title={copy.riskNote} body={article.risk_note} />
        </div>

        <section className="info-panel">
          <h2>{copy.tagsAndSource}</h2>
          <div className="tag-row">
            {article.tags.map((tag) => <span key={tag} className="tag">#{tag}</span>)}
          </div>
          <p className="muted">{copy.dailyFile}: <strong>{article.date}</strong></p>
          <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="primary-button">
            {copy.openOriginal}
          </a>
        </section>

        {reviewScores.length > 0 || article.review?.review_notes ? (
          <section className="info-panel">
            <h2>{copy.reviewMetadata}</h2>
            {reviewScores.length > 0 ? (
              <div className="score-grid" aria-label={copy.reviewScores}>
                {reviewScores.map(([label, value]) => <ScoreBadge key={label} label={label} value={value} />)}
              </div>
            ) : null}
            {article.review?.review_notes ? <p>{article.review.review_notes}</p> : null}
          </section>
        ) : null}
      </article>
    </main>
  );
}

function InfoPanel({ title, body }: { title: string; body: string }) {
  return <section className="info-panel"><h2>{title}</h2><p>{body}</p></section>;
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  return <span className="mini-score"><strong>{label}</strong><span>{value}/10</span></span>;
}

function compactScoreEntries(entries: Array<readonly [string, number | undefined]>): Array<readonly [string, number]> {
  return entries.filter((entry): entry is readonly [string, number] => typeof entry[1] === "number");
}
