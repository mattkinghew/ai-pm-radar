import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const queuePath = path.join(process.cwd(), "ai-agent", "QUEUE.md");
const dailyDir = path.join(process.cwd(), "data", "daily");

function printUsage() {
  console.log(`Usage:
  npm run daily:new -- YYYY-MM-DD
  npm run daily:new -- YYYY-MM-DD --dry-run

Creates:
  data/daily/YYYY-MM-DD.json
  a matching low-risk task in ai-agent/QUEUE.md

Notes:
  - This script does not call AI.
  - This script does not approve tasks.
  - This script does not run validation.
  - This script does not commit or push.
  - Fill the JSON with reviewed source-aware entries before running the validation gate.`);
}

function parseArgs(argv) {
  const args = argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    return { help: true };
  }

  const date = args.find((arg) => !arg.startsWith("--"));
  const dryRun = args.includes("--dry-run");

  return { date, dryRun };
}

function assertValidDate(date) {
  if (!DATE_PATTERN.test(date)) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }

  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Date is not a valid calendar date.");
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getNextTaskId(queueContent) {
  const taskNumbers = [...queueContent.matchAll(/TASK-(\d{3})/g)].map((match) => Number(match[1]));
  const nextNumber = taskNumbers.length > 0 ? Math.max(...taskNumbers) + 1 : 1;
  return `TASK-${String(nextNumber).padStart(3, "0")}`;
}

function buildDailyDraft(date) {
  return `${JSON.stringify({ date, articles: [] }, null, 2)}\n`;
}

function buildTaskBlock(taskId, date) {
  return `
- id: ${taskId}
  title: Add ${date} daily radar sample
  type: docs
  priority: high
  status: pending
  scope: ai-pm-radar
  risk: low
  approval_required: true
  input: |
    Add data/daily/${date}.json with 5 to 6 AI PM Radar entries.
    Use reviewed sources and keep source_url, business_angle, ai_pm_angle,
    and risk_note complete.
  validation:
    - npm run validate:data
    - npm run validate:daily
    - npm run build
`;
}

function insertTask(queueContent, taskBlock) {
  const marker = "\n## Safety Constraint";

  if (!queueContent.includes(marker)) {
    throw new Error("Cannot find '## Safety Constraint' marker in ai-agent/QUEUE.md.");
  }

  return queueContent.replace(marker, `${taskBlock}${marker}`);
}

async function main() {
  const { date, dryRun, help } = parseArgs(process.argv);

  if (help) {
    printUsage();
    return;
  }

  if (!date) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  assertValidDate(date);

  const dailyPath = path.join(dailyDir, `${date}.json`);
  const relativeDailyPath = path.join("data", "daily", `${date}.json`);

  const queueContent = await readFile(queuePath, "utf8");
  const taskId = getNextTaskId(queueContent);
  const taskBlock = buildTaskBlock(taskId, date);

  if (await fileExists(dailyPath)) {
    throw new Error(`${relativeDailyPath} already exists. Refusing to overwrite.`);
  }

  if (queueContent.includes(`Add ${date} daily radar sample`) || queueContent.includes(`data/daily/${date}.json`)) {
    throw new Error(`A queue task for ${date} appears to already exist. Refusing to duplicate it.`);
  }

  if (dryRun) {
    console.log("Daily update draft plan");
    console.log("=======================");
    console.log(`Date: ${date}`);
    console.log(`Task ID: ${taskId}`);
    console.log(`Daily file: ${relativeDailyPath}`);
    console.log("");
    console.log("No files were changed because --dry-run was used.");
    console.log("");
    console.log("Next command:");
    console.log(`npm run daily:new -- ${date}`);
    return;
  }

  await mkdir(dailyDir, { recursive: true });
  await writeFile(dailyPath, buildDailyDraft(date), "utf8");
  await writeFile(queuePath, insertTask(queueContent, taskBlock), "utf8");

  console.log("Daily update draft created");
  console.log("==========================");
  console.log(`Date: ${date}`);
  console.log(`Task ID: ${taskId}`);
  console.log(`Daily file: ${relativeDailyPath}`);
  console.log("");
  console.log("Important:");
  console.log("- Fill the articles array with 5 to 6 reviewed entries before validation.");
  console.log("- Then run:");
  console.log(`  npm run agent:approve -- ${taskId}`);
  console.log(`  npm run agent:run -- ${taskId}`);
}

main().catch((error) => {
  console.error("Daily update draft creation failed:");
  console.error(`- ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
