import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dailyDir = path.join(__dirname, "..", "data", "daily");

const requiredArticleFields = [
  "question_title",
  "short_title",
  "summary",
  "why_it_matters",
  "business_angle",
  "ai_pm_angle",
  "risk_note",
  "category",
  "tags",
  "source_name",
  "source_url",
  "published_at",
  "impact_score",
  "relevance_score",
  "trust_score",
];

const scoreFields = ["impact_score", "relevance_score", "trust_score"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUrl(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isScoreInRange(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 10;
}

function addIssue(collection, file, message) {
  collection.push(`${file}: ${message}`);
}

async function main() {
  const warnings = [];
  const errors = [];
  let checkedFiles = 0;
  let checkedArticles = 0;

  const entries = await readdir(dailyDir);
  const files = entries.filter((entry) => entry.endsWith(".json")).sort();

  if (files.length === 0) {
    addIssue(errors, "data/daily", "找不到任何 JSON 檔案。");
  }

  for (const file of files) {
    checkedFiles += 1;
    const filePath = path.join(dailyDir, file);
    const relativePath = path.join("data", "daily", file);
    let parsed;

    try {
      const raw = await readFile(filePath, "utf8");
      parsed = JSON.parse(raw);
    } catch (error) {
      addIssue(
        errors,
        relativePath,
        `JSON 讀取或解析失敗：${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      addIssue(errors, relativePath, "頂層內容必須是 object。");
      continue;
    }

    if (!isNonEmptyString(parsed.date)) {
      addIssue(errors, relativePath, "缺少頂層 date 欄位，或內容為空。");
    }

    if (!Array.isArray(parsed.articles)) {
      addIssue(errors, relativePath, "缺少頂層 articles array。");
      continue;
    }

    if (parsed.articles.length === 0) {
      addIssue(errors, relativePath, "articles array 不可為空。");
      continue;
    }

    const seenSourceUrls = new Set();

    parsed.articles.forEach((article, index) => {
      checkedArticles += 1;
      const articleLabel = `${relativePath} article[${index}]`;

      if (!article || typeof article !== "object" || Array.isArray(article)) {
        addIssue(errors, articleLabel, "article 必須是 object。");
        return;
      }

      for (const field of requiredArticleFields) {
        if (!(field in article)) {
          addIssue(errors, articleLabel, `缺少必填欄位 ${field}。`);
          continue;
        }

        if (
          [
            "question_title",
            "short_title",
            "summary",
            "why_it_matters",
            "business_angle",
            "ai_pm_angle",
            "risk_note",
            "category",
            "source_name",
            "source_url",
            "published_at",
          ].includes(field) &&
          !isNonEmptyString(article[field])
        ) {
          addIssue(errors, articleLabel, `欄位 ${field} 不可為空。`);
        }
      }

      if (!Array.isArray(article.tags)) {
        addIssue(errors, articleLabel, "欄位 tags 必須是 array。");
      } else if (article.tags.length === 0) {
        addIssue(warnings, articleLabel, "欄位 tags 為空，建議至少提供 1 個 tag。");
      }

      if (!isNonEmptyString(article.category)) {
        addIssue(errors, articleLabel, "欄位 category 不可為空。");
      }

      if (!isValidUrl(article.source_url)) {
        addIssue(errors, articleLabel, "欄位 source_url 不是有效的 http/https URL。");
      } else if (seenSourceUrls.has(article.source_url)) {
        addIssue(errors, articleLabel, `同一日檔案內出現重複 source_url：${article.source_url}`);
      } else {
        seenSourceUrls.add(article.source_url);
      }

      for (const scoreField of scoreFields) {
        if (!isScoreInRange(article[scoreField])) {
          addIssue(errors, articleLabel, `欄位 ${scoreField} 必須是 1 到 10 之間的數字。`);
        }
      }

      if (isNonEmptyString(article.published_at) && Number.isNaN(Date.parse(article.published_at))) {
        addIssue(warnings, articleLabel, "欄位 published_at 不是可解析日期，建議使用 ISO 8601。");
      }
    });

    const baseName = path.basename(file, ".json");
    if (isNonEmptyString(parsed.date) && parsed.date !== baseName) {
      addIssue(warnings, relativePath, `date 與檔名不一致：date=${parsed.date}，file=${baseName}.json`);
    }
  }

  console.log("AI PM Radar daily data validation");
  console.log(`Checked files: ${checkedFiles}`);
  console.log(`Articles checked: ${checkedArticles}`);
  console.log("");

  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
    console.log("");
  } else {
    console.log("Warnings:");
    console.log("- None");
    console.log("");
  }

  if (errors.length > 0) {
    console.error("Errors:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Errors:");
  console.log("- None");
}

main().catch((error) => {
  console.error("Errors:");
  console.error(`- 驗證腳本執行失敗：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
