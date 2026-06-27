"use client";

import { useMemo, useState } from "react";

import type { ArticleRecord } from "@/lib/articles";

import { ArticleCard } from "./ArticleCard";

type ArchiveExplorerProps = {
  articles: ArticleRecord[];
  categories: string[];
};

export function ArchiveExplorer({
  articles,
  categories,
}: ArchiveExplorerProps) {
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
          <p className="eyebrow">Category filter</p>
          <h2>Browse by topic</h2>
        </div>

        <div className="filter-row" role="tablist" aria-label="Category filter">
          <button
            type="button"
            className={selectedCategory === "All" ? "filter-chip active" : "filter-chip"}
            onClick={() => setSelectedCategory("All")}
          >
            All
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

      <div className="archive-list">
        {filteredArticles.map((article) => (
          <ArticleCard key={article.slug} article={article} expandable />
        ))}
      </div>
    </section>
  );
}
