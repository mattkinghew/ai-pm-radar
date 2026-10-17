import assert from "node:assert/strict";
import test from "node:test";

import { buildLaunchAgentPlist, nextWindow } from "../scripts/research-schedule.mjs";

test("launchd plist uses an absolute runner and runtime path without embedding provider secrets", () => {
  const plist = buildLaunchAgentPlist("/private/tmp/ai-pm-radar-research-test");
  assert.match(plist, /research-runner\.mjs/);
  assert.match(plist, /--scheduled/);
  assert.match(plist, /AI_PM_RADAR_RUNTIME_DIR/);
  assert.match(plist, /\/private\/tmp\/ai-pm-radar-research-test/);
  assert.doesNotMatch(plist, /API_KEY|GEMINI|OPENAI|Authorization/i);
});

test("next schedule window is expressed as one Asia-Hong-Kong catch-up window", () => {
  assert.match(nextWindow(new Date("2026-09-20T00:30:00.000Z")), /下一個香港日期/);
  assert.match(nextWindow(new Date("2026-09-19T23:30:00.000Z")), /今天/);
});
