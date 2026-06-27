import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const dailyDir = path.join(process.cwd(), "data", "daily");

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

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function addIssue(issues, filePath, message) {
  issues.push(`${filePath}: ${message}`);
}

async function validateDailyFile(fileName) {
  const issues = [];
  const filePath = path.join(dailyDir, fileName);
  const relativePath = path.join("data", "daily", fileName);

  let parsed;

  try {
    const raw = await readFile(filePath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    addIssue(issues, relativePath, `Cannot read or parse JSON: ${error.message}`);
    return { articleCount: 0, issues };
  }

  if (!isObject(parsed)) {
    addIssue(issues, relativePath, "Top-level JSON value must be an object.");
    return { articleCount: 0, issues };
  }

  if (!isNonEmptyString(parsed.date)) {
    addIssue(issues, relativePath, "Missing or empty required field: date.");
  }

  if (!Array.isArray(parsed.articles)) {
    addIssue(issues, relativePath, "Missing or invalid required field: articles must be an array.");
    return { articleCount: 0, issues };
  }

  parsed.articles.forEach((article, index) => {
    const articlePath = `${relativePath} articles[${index}]`;

    if (!isObject(article)) {
      addIssue(issues, articlePath, "Article must be an object.");
      return;
    }

    for (const field of requiredArticleFields) {
      if (!(field in article)) {
        addIssue(issues, articlePath, `Missing required field: ${field}.`);
      }
    }

    if ("tags" in article && !Array.isArray(article.tags)) {
      addIssue(issues, articlePath, "Field tags must be an array.");
    }

    for (const field of scoreFields) {
      if (field in article && typeof article[field] !== "number") {
        addIssue(issues, articlePath, `Field ${field} must be a number.`);
      }
    }

    if ("source_url" in article && !isNonEmptyString(article.source_url)) {
      addIssue(issues, articlePath, "Field source_url must be a non-empty string.");
    }
  });

  return { articleCount: parsed.articles.length, issues };
}

async function main() {
  const entries = await readdir(dailyDir);
  const jsonFiles = entries.filter((entry) => entry.endsWith(".json")).sort();
  const allIssues = [];
  let articleCount = 0;

  if (jsonFiles.length === 0) {
    addIssue(allIssues, "data/daily", "No daily JSON files found.");
  }

  for (const fileName of jsonFiles) {
    const result = await validateDailyFile(fileName);
    articleCount += result.articleCount;
    allIssues.push(...result.issues);
  }

  console.log("Daily JSON validation");
  console.log(`Files checked: ${jsonFiles.length}`);
  console.log(`Articles checked: ${articleCount}`);

  if (allIssues.length > 0) {
    console.error("Validation failed:");
    for (const issue of allIssues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Validation passed.");
}

main().catch((error) => {
  console.error("Validation failed:");
  console.error(`- ${error.message}`);
  process.exitCode = 1;
});
