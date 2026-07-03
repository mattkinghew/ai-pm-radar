import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const PROJECT_NAME = "ai-pm-radar";
const AGENT_DIR = path.join(ROOT, "ai-agent");
const QUEUE_PATH = path.join(AGENT_DIR, "QUEUE.md");
const STATE_PATH = path.join(AGENT_DIR, "state.json");
const LOG_DIR = path.join(AGENT_DIR, "logs");

function nowIso() {
  return new Date().toISOString();
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function ensureSafeRoot() {
  if (path.basename(ROOT) !== PROJECT_NAME) {
    fail(`Unsafe root: ${ROOT}. Expected folder: ${PROJECT_NAME}`);
  }
}

function ensureRequiredFiles() {
  if (!fs.existsSync(QUEUE_PATH)) fail("Missing ai-agent/QUEUE.md");
  if (!fs.existsSync(STATE_PATH)) fail("Missing ai-agent/state.json");
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function readState() {
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
}

function writeState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

function readQueue() {
  return fs.readFileSync(QUEUE_PATH, "utf-8");
}

function pendingSection(queueText) {
  const marker = "## Pending Tasks";
  const index = queueText.indexOf(marker);
  if (index === -1) return "";
  return queueText.slice(index);
}

function parseTasks(queueText) {
  const section = pendingSection(queueText);
  const blocks = section.split(/\n(?=- id: TASK-)/g);
  const tasks = [];

  for (const block of blocks) {
    const idMatch = block.match(/- id:\s*(TASK-[0-9A-Za-z_-]+)/);
    if (!idMatch) continue;

    const get = (key) => {
      const match = block.match(new RegExp(`\\n\\s*${key}:\\s*(.+)`));
      return match ? match[1].trim() : "";
    };

    const id = idMatch[1];

    if (id === "TASK-XXX") continue;

    tasks.push({
      id,
      title: get("title"),
      type: get("type"),
      priority: get("priority"),
      status: get("status"),
      scope: get("scope"),
      risk: get("risk"),
      approvalRequired: get("approval_required") === "true",
      raw: block.trim()
    });
  }

  return tasks;
}

function logEvent(event) {
  const logPath = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.jsonl`);
  fs.appendFileSync(logPath, JSON.stringify({ time: nowIso(), ...event }) + "\n");
}

function runCommand(command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}`);

  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function status() {
  const state = readState();
  const tasks = parseTasks(readQueue());

  console.log("AI Agent Executor Level 3");
  console.log("=========================");
  console.log(`Project root: ${ROOT}`);
  console.log(`Tasks found: ${tasks.length}`);
  console.log(`Approved tasks: ${state.approvedTasks.length}`);

  for (const task of tasks) {
    const approved = state.approvedTasks.includes(task.id) ? "approved" : "not approved";

    console.log("");
    console.log(`${task.id}`);
    console.log(`  title: ${task.title}`);
    console.log(`  type: ${task.type}`);
    console.log(`  priority: ${task.priority}`);
    console.log(`  status: ${task.status}`);
    console.log(`  risk: ${task.risk}`);
    console.log(`  approval: ${approved}`);
  }

  logEvent({ action: "status", taskCount: tasks.length });
}

function approve(taskId) {
  const tasks = parseTasks(readQueue());
  const task = tasks.find((item) => item.id === taskId);

  if (!task) fail(`Task not found: ${taskId}`);
  if (task.risk === "high") fail(`High-risk task requires manual review outside executor: ${taskId}`);

  const state = readState();

  if (!state.approvedTasks.includes(taskId)) {
    state.approvedTasks.push(taskId);
  }

  state.lastRun = nowIso();
  writeState(state);

  console.log(`✅ Approved ${taskId}`);
  logEvent({ action: "approve", taskId, risk: task.risk });
}

function run(taskId) {
  const state = readState();
  const tasks = parseTasks(readQueue());
  const task = tasks.find((item) => item.id === taskId);

  if (!task) fail(`Task not found: ${taskId}`);
  if (task.risk === "high") fail(`High-risk task refused: ${taskId}`);

  if (task.approvalRequired && !state.approvedTasks.includes(taskId)) {
    fail(`Task ${taskId} requires approval first. Run: npm run agent:approve -- ${taskId}`);
  }

  console.log(`🧪 Running validation gate for ${taskId}`);
  logEvent({ action: "run-start", taskId, risk: task.risk });

  try {
    runCommand("npm", ["run", "validate:data"]);
    runCommand("npm", ["run", "validate:daily"]);
    runCommand("npm", ["run", "build"]);

    logEvent({ action: "run-success", taskId });
    console.log(`\n✅ Validation gate passed for ${taskId}`);
  } catch (error) {
    logEvent({ action: "run-failed", taskId, error: error.message });
    fail(error.message);
  }
}

function rollbackPlan(taskId) {
  console.log("Manual rollback plan");
  console.log("====================");
  console.log(`Task: ${taskId}`);
  console.log("");
  console.log("This executor does not auto-rollback to avoid destructive actions.");
  console.log("");
  console.log("Recommended manual commands:");
  console.log("1. Check changed files:");
  console.log("   git status -sb");
  console.log("");
  console.log("2. Inspect diff:");
  console.log("   git diff");
  console.log("");
  console.log("3. Restore one file only if needed:");
  console.log("   git restore path/to/file");
  console.log("");
  console.log("4. Restore all uncommitted changes only if you are sure:");
  console.log("   git restore .");
  console.log("");
  console.log("Avoid git reset --hard unless you fully understand the consequence.");

  logEvent({ action: "rollback-plan", taskId });
}

function main() {
  ensureSafeRoot();
  ensureRequiredFiles();

  const command = process.argv[2] || "status";
  const taskId = process.argv[3];

  if (command === "status") return status();

  if (command === "approve") {
    if (!taskId) fail("Missing task id. Example: npm run agent:approve -- TASK-001");
    return approve(taskId);
  }

  if (command === "run") {
    if (!taskId) fail("Missing task id. Example: npm run agent:run -- TASK-001");
    return run(taskId);
  }

  if (command === "rollback-plan") {
    if (!taskId) fail("Missing task id. Example: npm run agent:rollback-plan -- TASK-001");
    return rollbackPlan(taskId);
  }

  fail(`Unknown command: ${command}`);
}

main();
