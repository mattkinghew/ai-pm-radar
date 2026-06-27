import { promises as fs } from "node:fs";
import path from "node:path";

export type Article = {
  question_title: string;
  short_title: string;
  summary: string;
  why_it_matters: string;
  business_angle: string;
  ai_pm_angle: string;
  risk_note: string;
  category: string;
  tags: string[];
  source_name: string;
  source_url: string;
  published_at: string;
  impact_score: number;
  relevance_score: number;
  trust_score: number;
};

type DailyFile = {
  date: string;
  articles: Article[];
};

export type ArticleRecord = Article & {
  date: string;
  slug: string;
  priority_score: number;
};

const DATA_DIR = path.join(process.cwd(), "data", "daily");

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function priorityScore(article: Article) {
  return Number(
    (
      article.impact_score * 0.5 +
      article.relevance_score * 0.3 +
      article.trust_score * 0.2
    ).toFixed(1),
  );
}

function toRecord(date: string, article: Article): ArticleRecord {
  return {
    ...article,
    date,
    slug: `${date}-${slugify(article.short_title || article.question_title)}`,
    priority_score: priorityScore(article),
  };
}

// Read all local JSON files at build time so the site stays fully static.
export async function getAllArticles() {
  const files = (await fs.readdir(DATA_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse();

  const records = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(DATA_DIR, file);
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as DailyFile;

      return parsed.articles.map((article) => toRecord(parsed.date, article));
    }),
  );

  return records.flat().sort((a, b) => {
    if (b.date !== a.date) {
      return b.date.localeCompare(a.date);
    }

    return b.priority_score - a.priority_score;
  });
}

export async function getLatestDate() {
  const articles = await getAllArticles();
  return articles[0]?.date ?? "";
}

export async function getTopArticles(limit = 5) {
  const articles = await getAllArticles();
  const latestDate = articles[0]?.date;

  return articles.filter((article) => article.date === latestDate).slice(0, limit);
}

export async function getCategories() {
  const articles = await getAllArticles();
  return Array.from(new Set(articles.map((article) => article.category))).sort();
}

export async function getArticleBySlug(slug: string) {
  const articles = await getAllArticles();
  return articles.find((article) => article.slug === slug);
}

export async function getArchiveByDate() {
  const articles = await getAllArticles();
  const archive = new Map<string, ArticleRecord[]>();

  for (const article of articles) {
    const existing = archive.get(article.date) ?? [];
    existing.push(article);
    archive.set(article.date, existing);
  }

  return Array.from(archive.entries()).map(([date, items]) => ({
    date,
    items,
  }));
}
