"use client";

import type { ArticleRecord } from "@/lib/articles";

import { ArchiveExplorer } from "./ArchiveExplorer";
import { useLanguage } from "./LanguageProvider";

type ArchivePageContentProps = {
  articles: ArticleRecord[];
  categories: string[];
};

export function ArchivePageContent({
  articles,
  categories,
}: ArchivePageContentProps) {
  const { t } = useLanguage();

  return (
    <main className="container section stack-lg">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("archiveEyebrow")}</p>
          <h1>{t("archiveTitle")}</h1>
        </div>
        <p className="section-note">{t("archiveDescription")}</p>
      </div>

      <ArchiveExplorer articles={articles} categories={categories} />
    </main>
  );
}
