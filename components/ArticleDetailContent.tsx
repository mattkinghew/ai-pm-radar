"use client";

import Link from "next/link";

import type { ArticleRecord } from "@/lib/articles";
import { formatDate, formatDateTime } from "@/lib/format";

import { useLanguage } from "./LanguageProvider";

type ArticleDetailContentProps = {
  article: ArticleRecord;
};

export function ArticleDetailContent({ article }: ArticleDetailContentProps) {
  const { language, t } = useLanguage();
  const reviewScores = article.review?.scoring
    ? compactScoreEntries([
        ["AI PM relevance", article.review.scoring.ai_pm_relevance],
        ["HK relevance", article.review.scoring.hk_relevance],
        ["Actionability", article.review.scoring.actionability],
        ["Technical depth", article.review.scoring.technical_depth],
        ["Portfolio value", article.review.scoring.portfolio_value],
      ])
    : [];

  return (
    <main className="container section stack-lg">
      <div className="breadcrumb">
        <Link href="/archive">{t("archive")}</Link>
        <span>/</span>
        <span>{formatDate(article.date, language)}</span>
      </div>

      <article className="detail-page">
        <div className="detail-header">
          <div className="meta-row">
            <span className="category-pill">{article.category}</span>
            <span className="score-pill">
              {t("score")} {article.priority_score}
            </span>
            {article.review?.status ? (
              <span className="review-pill">
                {t("review")} {formatReviewStatus(article.review.status)}
              </span>
            ) : null}
          </div>
          <h1>{article.question_title}</h1>
          <p className="muted">
            {article.source_name} · {formatDateTime(article.published_at, language)}
          </p>
          <p className="lead">{article.summary}</p>
          <div className="score-grid" aria-label={t("coreArticleScores")}>
            <ScoreBadge label={t("impact")} value={article.impact_score} />
            <ScoreBadge label={t("relevance")} value={article.relevance_score} />
            <ScoreBadge label={t("trust")} value={article.trust_score} />
          </div>
        </div>

        <div className="grid-two">
          <section className="info-panel">
            <h2>{t("whyItMatters")}</h2>
            <p>{article.why_it_matters}</p>
          </section>
          <section className="info-panel">
            <h2>{t("businessAngle")}</h2>
            <p>{article.business_angle}</p>
          </section>
          <section className="info-panel">
            <h2>{t("aiPmAngle")}</h2>
            <p>{article.ai_pm_angle}</p>
          </section>
          <section className="info-panel">
            <h2>{t("riskNote")}</h2>
            <p>{article.risk_note}</p>
          </section>
        </div>

        <section className="info-panel">
          <h2>{t("tagsAndSource")}</h2>
          <div className="tag-row" aria-label={t("articleTags")}>
            {article.tags.map((tag) => (
              <span key={tag} className="tag">
                #{tag}
              </span>
            ))}
          </div>
          <p className="muted">
            {t("dailyFile")}: <strong>{article.date}</strong>
          </p>
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="primary-button"
          >
            {t("openOriginalSource")}
          </a>
        </section>

        {reviewScores.length > 0 || article.review?.review_notes ? (
          <section className="info-panel">
            <h2>{t("reviewMetadata")}</h2>
            {reviewScores.length > 0 ? (
              <div className="score-grid" aria-label={t("reviewScoringDimensions")}>
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
