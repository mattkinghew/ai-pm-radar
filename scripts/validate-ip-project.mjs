import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, "..", "data", "ip-projects", "sample-instructor.json");
const relativePath = path.join("data", "ip-projects", "sample-instructor.json");

const requiredTopLevelFields = [
  "project_name",
  "client_type",
  "business_goal",
  "target_audience",
  "positioning",
  "main_offer",
  "workflow",
  "content_pillars",
  "risk_controls",
  "success_metrics",
];

const requiredWorkflowFields = [
  "stage",
  "status",
  "owner",
  "deliverable",
  "risk",
  "next_action",
];

const allowedStatuses = new Set(["not_started", "in_progress", "blocked", "done"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function addIssue(collection, label, message) {
  collection.push(`${label}: ${message}`);
}

function findStage(workflow, stageName) {
  return workflow.find(
    (item) => isObject(item) && isNonEmptyString(item.stage) && item.stage.trim().toLowerCase() === stageName,
  );
}

async function main() {
  const errors = [];
  const passes = [];
  let parsed;

  try {
    const raw = await readFile(filePath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("IP project validation failed");
    console.error(
      `${relativePath}: JSON 讀取或解析失敗：${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  if (!isObject(parsed)) {
    addIssue(errors, relativePath, "頂層內容必須是 object。");
  } else {
    for (const field of requiredTopLevelFields) {
      if (!(field in parsed)) {
        addIssue(errors, relativePath, `缺少頂層欄位 ${field}。`);
      }
    }

    for (const field of ["project_name", "client_type", "business_goal"]) {
      if (field in parsed && !isNonEmptyString(parsed[field])) {
        addIssue(errors, relativePath, `欄位 ${field} 不可為空。`);
      }
    }

    if (!Array.isArray(parsed.workflow)) {
      addIssue(errors, relativePath, "workflow 必須是 non-empty array。");
    } else if (parsed.workflow.length === 0) {
      addIssue(errors, relativePath, "workflow 不可為空。");
    } else {
      passes.push("workflow array exists and is non-empty");

      parsed.workflow.forEach((item, index) => {
        const label = `${relativePath} workflow[${index}]`;

        if (!isObject(item)) {
          addIssue(errors, label, "workflow item 必須是 object。");
          return;
        }

        for (const field of requiredWorkflowFields) {
          if (!(field in item)) {
            addIssue(errors, label, `缺少欄位 ${field}。`);
            continue;
          }

          if (!isNonEmptyString(item[field])) {
            addIssue(errors, label, `欄位 ${field} 不可為空。`);
          }
        }

        if ("status" in item && !allowedStatuses.has(item.status)) {
          addIssue(
            errors,
            label,
            `欄位 status 必須是 ${Array.from(allowedStatuses).join(", ")} 其中之一。`,
          );
        }
      });

      const humanReviewStage = findStage(parsed.workflow, "human review");
      const publishingStage = findStage(parsed.workflow, "publishing");

      if (!humanReviewStage) {
        addIssue(errors, relativePath, "workflow 缺少 Human Review stage。");
      }

      if (!publishingStage) {
        addIssue(errors, relativePath, "workflow 缺少 Publishing stage。");
      }

      if (
        humanReviewStage &&
        publishingStage &&
        publishingStage.status === "done" &&
        humanReviewStage.status !== "done"
      ) {
        addIssue(errors, relativePath, "Publishing 不能在 Human Review 完成前標示為 done。");
      } else if (humanReviewStage && publishingStage) {
        passes.push("Publishing and Human Review dependency check passed");
      }
    }

    if (!Array.isArray(parsed.risk_controls) || parsed.risk_controls.length === 0) {
      addIssue(errors, relativePath, "risk_controls 必須是 non-empty array。");
    } else {
      passes.push("risk_controls exists and is non-empty");
    }

    if (!Array.isArray(parsed.success_metrics) || parsed.success_metrics.length === 0) {
      addIssue(errors, relativePath, "success_metrics 必須是 non-empty array。");
    } else {
      passes.push("success_metrics exists and is non-empty");
    }
  }

  console.log("AI-assisted IP project validation");
  console.log(`File: ${relativePath}`);

  if (passes.length > 0) {
    console.log("Pass checks:");
    passes.forEach((message) => console.log(`- ${message}`));
  }

  if (errors.length > 0) {
    console.error("Validation failed:");
    errors.forEach((message) => console.error(`- ${message}`));
    process.exit(1);
  }

  console.log("Validation passed.");
}

main().catch((error) => {
  console.error("IP project validation failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
