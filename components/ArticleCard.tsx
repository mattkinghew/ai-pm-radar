"use client";

import Link from "next/link";
import { useId, useState } from "react";

import type { ArticleRecord } from "@/lib/articles";
import { formatDateTime } from "@/lib/format";
import { useLanguage } from "@/components/LanguageProvider";

type ArticleCardProps = {
  article: ArticleRecord;
  expandable?: boolean;
};

export function ArticleCard({ article, expandable = false }: ArticleCardProps) {
  const { locale, messages } = useLanguage();
  const copy = messages.article;
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
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
    <article className="article-card">
      <div className="card-head">
        <div className="meta-row">
          <span className="category-pill">{article.category}</span>
          <span className="score-pill">{copy.score} {article.priority_score}</span>
          {article.review?.status ? (
            <span className="review-pill">{copy.review} {article.review.status === "reviewed" ? copy.reviewed : copy.draft}</span>
          ) : null}
        </div>
        <h3>{article.question_title}</h3>
        <p className="muted">
          {article.source_name} {copy.sourceDateSeparator} {formatDateTime(article.published_at, locale)}
        </p>
      </div>

      <p>{article.summary}</p>

      <div className="score-grid" aria-label={copy.coreScores}>
        <ScoreBadge label={copy.impact} value={article.impact_score} />
        <ScoreBadge label={copy.relevance} value={article.relevance_score} />
        <ScoreBadge label={copy.trust} value={article.trust_score} />
      </div>

      <div className="scan-grid" aria-label={copy.quickScan}>
        <DetailBlock title={copy.aiPmAngle} body={article.ai_pm_angle} compact />
        <DetailBlock title={copy.businessAngle} body={article.business_angle} compact />
        <DetailBlock title={copy.riskNote} body={article.risk_note} compact />
      </div>

      <div className="tag-row" aria-label={copy.tags}>
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
            {isOpen ? copy.hide : copy.expand}
          </button>

          {isOpen ? (
            <div id={panelId} className="detail-grid">
              <DetailBlock title={copy.whyItMatters} body={article.why_it_matters} />
              <DetailBlock title={copy.businessAngle} body={article.business_angle} />
              <DetailBlock title={copy.aiPmAngle} body={article.ai_pm_angle} />
              <DetailBlock title={copy.riskNote} body={article.risk_note} />
              {reviewScores.length > 0 ? (
                <section className="detail-panel">
                  <h4>{copy.reviewScoring}</h4>
                  <div className="score-grid" aria-label={copy.reviewScores}>
                    {reviewScores.map(([label, value]) => (
                      <ScoreBadge key={label} label={label} value={value} />
                    ))}
                  </div>
                </section>
              ) : null}
              {article.review?.review_notes ? (
                <DetailBlock title={copy.reviewNote} body={article.review.review_notes} />
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
          {copy.openSource}
        </a>
        <Link href={`/article/${article.slug}`} className="primary-button">
          {copy.readDetail}
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

function compactScoreEntries(
  entries: Array<readonly [string, number | undefined]>,
): Array<readonly [string, number]> {
  return entries.filter((entry): entry is readonly [string, number] => {
    return typeof entry[1] === "number";
  });
}
