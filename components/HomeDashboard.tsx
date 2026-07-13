"use client";

import Link from "next/link";

import { formatDate } from "@/lib/format";
import type { ArticleRecord } from "@/lib/articles";

import { ArticleCard } from "./ArticleCard";
import { useLanguage } from "./LanguageProvider";

type HomeDashboardProps = {
  latestDate: string;
  topArticles: ArticleRecord[];
};

export function HomeDashboard({ latestDate, topArticles }: HomeDashboardProps) {
  const { language, t } = useLanguage();

  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy-block stack-lg">
            <div className="stack-md">
              <p className="eyebrow">{t("staticDailyBrief")}</p>
              <h1 className="hero-title">{t("heroTitle")}</h1>
              <p className="hero-copy">{t("heroCopy")}</p>
            </div>

            <div className="cta-row hero-cta-row">
              <Link href="/archive" className="primary-button">
                {t("browseArchive")}
              </Link>
              <Link href="/marketing-ops-demo" className="secondary-button">
                {t("marketingOpsDemo")}
              </Link>
              <Link href="/about" className="secondary-button">
                {t("aboutMvp")}
              </Link>
            </div>

            <div className="hero-status-row">
              <span className="status-chip">{t("todaysTop5")}</span>
              <span className="status-chip">
                {t("lastUpdated")}:{" "}
                {latestDate ? formatDate(latestDate, language) : t("noDataYet")}
              </span>
            </div>
          </div>

          <aside className="hero-panel">
            <div className="hero-panel-head">
              <div>
                <p className="eyebrow">{t("todaysFocus")}</p>
                <h2>{t("todaysTop5")}</h2>
              </div>
              <p className="hero-date">
                {t("lastUpdated")}:{" "}
                {latestDate ? formatDate(latestDate, language) : t("noDataYet")}
              </p>
            </div>

            <ul className="hero-top-list">
              {topArticles.map((article, index) => (
                <li key={article.slug} className="hero-top-card">
                  <div className="hero-item-head">
                    <span className="hero-rank">#{index + 1}</span>
                    <span className="score-pill">
                      {t("score")} {article.priority_score}
                    </span>
                  </div>
                  <Link href={`/article/${article.slug}`} className="hero-item-link">
                    {article.short_title}
                  </Link>
                  <p className="hero-summary">{article.ai_pm_angle}</p>
                  <div className="hero-item-meta">
                    <span className="meta-chip">
                      {t("category")}: {article.category}
                    </span>
                    <span className="meta-chip meta-chip-risk">
                      {t("risk")}: {article.risk_note}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section className="container section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("top5Daily")}</p>
            <h2>{t("highestPrioritySignals")}</h2>
          </div>
          <p className="section-note">{t("homeSectionNote")}</p>
        </div>

        <div className="archive-list">
          {topArticles.map((article) => (
            <ArticleCard key={article.slug} article={article} expandable />
          ))}
        </div>
      </section>
    </main>
  );
}
