"use client";

import { useMemo, useState } from "react";

import type { ArticleRecord } from "@/lib/articles";

import { ArticleCard } from "./ArticleCard";
import { useLanguage } from "./LanguageProvider";

type ArchiveExplorerProps = {
  articles: ArticleRecord[];
  categories: string[];
};

const ALL_CATEGORIES = "__all__";

export function ArchiveExplorer({
  articles,
  categories,
}: ArchiveExplorerProps) {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);

  const filteredArticles = useMemo(() => {
    if (selectedCategory === ALL_CATEGORIES) {
      return articles;
    }

    return articles.filter((article) => article.category === selectedCategory);
  }, [articles, selectedCategory]);

  return (
    <section className="stack-lg">
      <div className="filter-panel">
        <div>
          <p className="eyebrow">{t("categoryFilter")}</p>
          <h2>{t("browseByTopic")}</h2>
          <p className="section-note">
            {filteredArticles.length}{" "}
            {filteredArticles.length === 1 ? t("resultSingle") : t("resultPlural")}{" "}
            {selectedCategory === ALL_CATEGORIES
              ? t("acrossAllCategories")
              : `${t("inCategory")} ${selectedCategory}`}
          </p>
        </div>

        <div className="filter-row" role="tablist" aria-label="Category filter">
          <button
            type="button"
            className={
              selectedCategory === ALL_CATEGORIES ? "filter-chip active" : "filter-chip"
            }
            onClick={() => setSelectedCategory(ALL_CATEGORIES)}
          >
            {t("all")}
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
          <button
            type="button"
            className="filter-chip"
            onClick={() => setSelectedCategory(ALL_CATEGORIES)}
          >
            {t("resetFilters")}
          </button>
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
          <p className="eyebrow">{t("noResults")}</p>
          <h3>{t("noEntriesMatch")}</h3>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSelectedCategory(ALL_CATEGORIES)}
          >
            {t("switchBackToAll")}
          </button>
        </div>
      )}
    </section>
  );
}
