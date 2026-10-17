"use client";

import { useMemo, useState } from "react";

import type { ArticleRecord } from "@/lib/articles";
import { useLanguage } from "@/components/LanguageProvider";

import { ArticleCard } from "./ArticleCard";

type ArchiveExplorerProps = {
  articles: ArticleRecord[];
  categories: string[];
};

export function ArchiveExplorer({
  articles,
  categories,
}: ArchiveExplorerProps) {
  const { messages } = useLanguage();
  const copy = messages.archive;
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredArticles = useMemo(() => {
    if (selectedCategory === "All") {
      return articles;
    }

    return articles.filter((article) => article.category === selectedCategory);
  }, [articles, selectedCategory]);

  return (
    <section className="stack-lg">
      <div className="filter-panel">
        <div>
          <p className="eyebrow">{copy.filterEyebrow}</p>
          <h2>{copy.browse}</h2>
          <p className="section-note">
            {filteredArticles.length} {selectedCategory === "All" ? copy.resultAll : `${copy.resultIn} ${selectedCategory}`}
          </p>
        </div>

        <div className="filter-row" role="tablist" aria-label={copy.filterEyebrow}>
          <button
            type="button"
            className={selectedCategory === "All" ? "filter-chip active" : "filter-chip"}
            onClick={() => setSelectedCategory("All")}
          >
            {copy.all}
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={
                selectedCategory === category ? "filter-chip active" : "filter-chip"
              }
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {filteredArticles.length > 0 ? (
        <div className="archive-list">
          {filteredArticles.map((article) => (
            <ArticleCard key={article.slug} article={article} expandable />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p className="eyebrow">{copy.noResults}</p>
          <h3>{copy.noResultsTitle}</h3>
          <p>{copy.noResultsHint}</p>
        </div>
      )}
    </section>
  );
}
