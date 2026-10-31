"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { ArticleCard } from "@/components/ArticleCard";
import { HomeQuickCapture } from "@/components/HomeQuickCapture";
import { useLanguage } from "@/components/LanguageProvider";
import type { ArticleRecord } from "@/lib/articles";
import { calendarDayAge, dateInTimeZone, formatDate } from "@/lib/format";

type HomeContentProps = {
  topArticles: ArticleRecord[];
  latestDate: string;
};

export function HomeContent({ topArticles, latestDate }: HomeContentProps) {
  const { locale, messages } = useLanguage();
  const copy = messages.home;
  const [today, setToday] = useState("");
  useEffect(() => setToday(dateInTimeZone(new Date(), "Asia/Hong_Kong")), []);
  const dataAge = today && latestDate ? calendarDayAge(latestDate, today) : null;

  return (
    <main>
      <HomeQuickCapture />
      <section className="hero">
        <div className="container hero-grid">
          <div className="stack-lg">
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p className="hero-copy">{copy.copy}</p>
            <div className="cta-row">
              <Link href="/archive" className="primary-button">
                {copy.browseArchive}
              </Link>
              <Link href="/research" className="secondary-button">
                {copy.browseResearch}
              </Link>
              <Link href="/source-inbox" className="secondary-button">
                {copy.openSourceInbox}
              </Link>
              <Link href="/about" className="secondary-button">
                {copy.aboutMvp}
              </Link>
            </div>
          </div>

          <div className="hero-panel">
            <p className="eyebrow">{copy.todaysFocus}</p>
            <h2>{copy.topFive}</h2>
            <p className="hero-date">{latestDate ? formatDate(latestDate, locale) : copy.noData}</p>
            {dataAge !== null ? (
              <p className="hero-freshness">
                {copy.dataAge.replace("{days}", String(dataAge))}
                {dataAge > 7 ? <span className="stale-data-badge">{copy.staleEdition}</span> : null}
              </p>
            ) : null}
            <ul className="hero-top-list">
              {topArticles.map((article, index) => (
                <li key={article.slug}>
                  <div className="hero-item-head">
                    <span className="hero-rank">#{index + 1}</span>
                    <span className="score-pill">
                      {copy.score} {article.priority_score}
                    </span>
                  </div>
                  <Link href={`/article/${article.slug}`} className="hero-item-link">
                    {article.short_title}
                  </Link>
                  <p>{article.ai_pm_angle}</p>
                  <div className="hero-item-meta">
                    <span>{article.category}</span>
                    <span>
                      {copy.risk}: {article.risk_note}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{copy.topFiveDaily}</p>
            <h2>{copy.highestPriority}</h2>
          </div>
          <p className="section-note">{copy.sectionNote}</p>
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
