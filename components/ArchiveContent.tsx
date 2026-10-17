"use client";

import { useLanguage } from "@/components/LanguageProvider";
import type { ArticleRecord } from "@/lib/articles";

import { ArchiveExplorer } from "./ArchiveExplorer";

export function ArchiveContent({ articles, categories }: { articles: ArticleRecord[]; categories: string[] }) {
  const { messages } = useLanguage();
  const copy = messages.archive;

  return (
    <main className="container section stack-lg">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
        </div>
        <p className="section-note">{copy.note}</p>
      </div>
      <ArchiveExplorer articles={articles} categories={categories} />
    </main>
  );
}
