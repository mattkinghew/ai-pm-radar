"use client";

import Link from "next/link";
import { useId, useState } from "react";

import type { ArticleRecord } from "@/lib/articles";
import { formatDateTime } from "@/lib/format";

type ArticleCardProps = {
  article: ArticleRecord;
  expandable?: boolean;
};

export function ArticleCard({ article, expandable = false }: ArticleCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  return (
    <article className="article-card">
      <div className="card-head">
        <div className="meta-row">
          <span className="category-pill">{article.category}</span>
          <span className="score-pill">Score {article.priority_score}</span>
        </div>
        <h3>{article.question_title}</h3>
        <p className="muted">
          {article.source_name} · {formatDateTime(article.published_at)}
        </p>
      </div>

      <p>{article.summary}</p>

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
            {isOpen ? "Hide analysis" : "Expand analysis"}
          </button>

          {isOpen ? (
            <div id={panelId} className="detail-grid">
              <DetailBlock title="Why it matters" body={article.why_it_matters} />
              <DetailBlock title="Business angle" body={article.business_angle} />
              <DetailBlock title="AI PM angle" body={article.ai_pm_angle} />
              <DetailBlock title="Risk note" body={article.risk_note} />
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
          Open source
        </a>
        <Link href={`/article/${article.slug}`} className="primary-button">
          Read detail
        </Link>
      </div>
    </article>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h4>{title}</h4>
      <p>{body}</p>
    </section>
  );
}
