import { readFile } from "node:fs/promises";
import path from "node:path";

const filePath = path.join(process.cwd(), "data", "marketing-ops", "sample-campaign.json");

const requiredTopLevelFields = [
  "demo_name",
  "audience_segments",
  "positioning",
  "campaign_name",
  "demo_boundaries",
  "funnel_metrics",
  "creative_analysis",
  "ai_outputs",
  "risk_controls",
];

const requiredFunnelFields = [
  "reach",
  "clicks",
  "group_joins",
  "messages_received",
  "messages_replied",
  "registrations",
  "attendance",
  "spend",
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function addIssue(issues, message) {
  issues.push(message);
}

async function main() {
  const issues = [];
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!isObject(parsed)) {
    throw new Error("Top-level JSON must be an object.");
  }

  for (const field of requiredTopLevelFields) {
    if (!(field in parsed)) {
      addIssue(issues, `Missing top-level field: ${field}.`);
    }
  }

  if (!Array.isArray(parsed.audience_segments) || parsed.audience_segments.length === 0) {
    addIssue(issues, "audience_segments must be a non-empty array.");
  }

  if (!Array.isArray(parsed.demo_boundaries) || parsed.demo_boundaries.length === 0) {
    addIssue(issues, "demo_boundaries must be a non-empty array.");
  }

  if (!Array.isArray(parsed.risk_controls) || parsed.risk_controls.length === 0) {
    addIssue(issues, "risk_controls must be a non-empty array.");
  }

  if (!isObject(parsed.funnel_metrics)) {
    addIssue(issues, "funnel_metrics must be an object.");
  } else {
    for (const field of requiredFunnelFields) {
      if (!isNonNegativeNumber(parsed.funnel_metrics[field])) {
        addIssue(issues, `funnel_metrics.${field} must be a non-negative number.`);
      }
    }

    if (parsed.funnel_metrics.attendance > parsed.funnel_metrics.registrations) {
      addIssue(issues, "attendance must be less than or equal to registrations.");
    }

    if (parsed.funnel_metrics.messages_replied > parsed.funnel_metrics.messages_received) {
      addIssue(issues, "messages_replied must be less than or equal to messages_received.");
    }

    if (parsed.funnel_metrics.group_joins > parsed.funnel_metrics.clicks) {
      addIssue(issues, "group_joins must be less than or equal to clicks.");
    }
  }

  if (!Array.isArray(parsed.creative_analysis) || parsed.creative_analysis.length === 0) {
    addIssue(issues, "creative_analysis must be a non-empty array.");
  } else {
    parsed.creative_analysis.forEach((item, index) => {
      if (!isObject(item)) {
        addIssue(issues, `creative_analysis[${index}] must be an object.`);
        return;
      }

      for (const field of [
        "creative_id",
        "format",
        "hook_text",
        "caption",
        "visual_description",
        "first_3_seconds_description",
        "performance_summary",
        "possible_issue",
        "ai_suggestion",
        "next_action",
      ]) {
        if (!isNonEmptyString(item[field])) {
          addIssue(issues, `creative_analysis[${index}].${field} must be a non-empty string.`);
        }
      }
    });
  }

  if (!isObject(parsed.ai_outputs)) {
    addIssue(issues, "ai_outputs must be an object.");
  } else {
    for (const field of [
      "weekly_report_draft",
      "ad_copy_ideas",
      "ppt_outline",
      "follow_up_suggestions",
    ]) {
      if (!Array.isArray(parsed.ai_outputs[field]) || parsed.ai_outputs[field].length === 0) {
        addIssue(issues, `ai_outputs.${field} must be a non-empty array.`);
      }
    }
  }

  console.log("Marketing ops demo validation");
  console.log(`Checked file: ${filePath}`);

  if (issues.length > 0) {
    console.error("Validation failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Validation passed.");
}

main().catch((error) => {
  console.error("Validation failed:");
  console.error(`- ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
