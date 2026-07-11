import Link from "next/link";

import { ArticleCard } from "@/components/ArticleCard";
import { Header } from "@/components/Header";
import { getLatestDate, getTopArticles } from "@/lib/articles";
import { formatDate } from "@/lib/format";

export default async function HomePage() {
  const [topArticles, latestDate] = await Promise.all([
    getTopArticles(),
    getLatestDate(),
  ]);

  return (
    <>
      <Header currentPath="/" />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="stack-lg">
              <p className="eyebrow">Static daily brief</p>
              <h1>Daily AI radar for practical AI PM learning and SME awareness</h1>
              <p className="hero-copy">
                Track the five most relevant signals each day without needing a
                backend, API key, or technical research workflow.
              </p>
              <div className="cta-row">
                <Link href="/archive" className="primary-button">
                  Browse archive
                </Link>
                <Link href="/about" className="secondary-button">
                  About this MVP
                </Link>
              </div>
            </div>

            <div className="hero-panel">
              <p className="eyebrow">Today&apos;s focus</p>
              <h2>Today&apos;s Top 5</h2>
              <p className="hero-date">{latestDate ? formatDate(latestDate) : "No data yet"}</p>
              <ul className="hero-top-list">
                {topArticles.map((article, index) => (
                  <li key={article.slug}>
                    <div className="hero-item-head">
                      <span className="hero-rank">#{index + 1}</span>
                      <span className="score-pill">Score {article.priority_score}</span>
                    </div>
                    <Link href={`/article/${article.slug}`} className="hero-item-link">
                      {article.short_title}
                    </Link>
                    <p>{article.ai_pm_angle}</p>
                    <div className="hero-item-meta">
                      <span>{article.category}</span>
                      <span>Risk: {article.risk_note}</span>
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
              <p className="eyebrow">Top 5 daily</p>
              <h2>Highest-priority signals from the latest file</h2>
            </div>
            <p className="section-note">
              Ranked with the existing weighted score based on impact, relevance,
              and trust, with optional review metadata shown when present.
            </p>
          </div>

          <div className="archive-list">
            {topArticles.map((article) => (
              <ArticleCard key={article.slug} article={article} expandable />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
