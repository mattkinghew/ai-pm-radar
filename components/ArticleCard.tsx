"use client";

import Link from "next/link";
import { useId, useState } from "react";

import type { ArticleRecord } from "@/lib/articles";
import { formatDateTime } from "@/lib/format";

import { useLanguage } from "./LanguageProvider";

type ArticleCardProps = {
  article: ArticleRecord;
  expandable?: boolean;
};

export function ArticleCard({ article, expandable = false }: ArticleCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const { language, t } = useLanguage();
  const reviewScores = article.review?.scoring
    ? compactScoreEntries([
        ["AI PM", article.review.scoring.ai_pm_relevance],
        ["HK", article.review.scoring.hk_relevance],
        ["Action", article.review.scoring.actionability],
        ["Tech", article.review.scoring.technical_depth],
        ["Portfolio", article.review.scoring.portfolio_value],
      ])
    : [];

  return (
    <article className="article-card">
      <div className="card-head">
        <div className="meta-row">
          <span className="category-pill">
            {t("category")}: {article.category}
          </span>
          <span className="score-pill">
            {t("score")} {article.priority_score}
          </span>
          {article.review?.status ? (
            <span className="review-pill">
              {t("review")} {formatReviewStatus(article.review.status)}
            </span>
          ) : null}
        </div>
        <h3>{article.question_title}</h3>
        <p className="muted">
          {article.source_name} · {formatDateTime(article.published_at, language)}
        </p>
      </div>

      <p>{article.summary}</p>

      <div className="score-grid" aria-label="Core article scores">
        <ScoreBadge label={t("impact")} value={article.impact_score} />
        <ScoreBadge label={t("relevance")} value={article.relevance_score} />
        <ScoreBadge label={t("trust")} value={article.trust_score} />
      </div>

      <div className="scan-grid" aria-label="Quick article scan">
        <DetailBlock title={t("aiPmAngle")} body={article.ai_pm_angle} compact />
        <DetailBlock title={t("businessAngle")} body={article.business_angle} compact />
        <DetailBlock title={t("riskNote")} body={article.risk_note} compact />
      </div>

      <div className="tag-row" aria-label="Article tags">
        {article.tags.map((tag) => (
          <span key={tag} className="tag">
            #{tag}
          </span>
        ))}
      </div>

      {expandable ? (
        <>
          <button
            type="button"
            className="secondary-button"
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={() => setIsOpen((value) => !value)}
          >
            {isOpen ? t("hideAnalysis") : t("expandAnalysis")}
          </button>

          {isOpen ? (
            <div id={panelId} className="detail-grid">
              <DetailBlock title={t("whyItMatters")} body={article.why_it_matters} />
              <DetailBlock title={t("businessAngle")} body={article.business_angle} />
              <DetailBlock title={t("aiPmAngle")} body={article.ai_pm_angle} />
              <DetailBlock title={t("riskNote")} body={article.risk_note} />
              {reviewScores.length > 0 ? (
                <section className="detail-panel">
                  <h4>{t("reviewScoring")}</h4>
                  <div className="score-grid" aria-label="Review scoring dimensions">
                    {reviewScores.map(([label, value]) => (
                      <ScoreBadge key={label} label={label} value={value} />
                    ))}
                  </div>
                </section>
              ) : null}
              {article.review?.review_notes ? (
                <DetailBlock title={t("reviewNote")} body={article.review.review_notes} />
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      <div className="card-actions">
        <a
          href={article.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link"
        >
          {t("source")}
        </a>
        <Link href={`/article/${article.slug}`} className="primary-button">
          {t("readMore")}
        </Link>
      </div>
    </article>
  );
}

function DetailBlock({
  title,
  body,
  compact = false,
}: {
  title: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "detail-panel compact-panel" : "detail-panel"}>
      <h4>{title}</h4>
      <p>{body}</p>
    </section>
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
