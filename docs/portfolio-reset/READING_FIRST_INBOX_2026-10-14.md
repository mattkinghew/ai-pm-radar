# AI PM Radar — Reading-first Source Inbox UI Candidate (2026-10-14)

## Owner observation
Owner confirmed live Gemini analysis succeeded using an English-language Grok Bot article but the long English draft was difficult to read. Source Inbox Review remained blocked by explicit human approval, missing creator/source name, and ungraded evidence. Screenshots showed generated key-claim evidence, not an empty evidence set. Existing system gate was not a code defect.

## Primary outcome
Make the EXISTING intake → readable Chinese draft → evidence review → manual approval → candidate export path less effortful without schema migrations, weakening source evidence, or introducing external AI calls.

## Scope implemented (LOCAL ONLY)
- scripts/source-fetch-helper.mjs: ask new AI analyses to produce zh-Hant for reader-facing narrative (summary, headlines, key points, implications, inferences, scoring rationales); preserve original-language verbatim citation text and methods. Source language hint remains about source language, not requested output language. Still subject to provider compliance; no second model call.
- components/SourceInboxWorkbench.tsx: reading-first article card with title, summary, key points, why-it-matters, AI PM implications; edit-summary jump into existing enrichment editor. Original source, provenance, evidence picker, method-only and raw analysis fields collapsed but available. Key-claim evidence remains inspectable.
- In Review: article overview and expandable claim references; creator and evidence_grade editable in-place rather than asking Owner to find the fields in a large draft form; explain manual grading and approval order. Optional Source Library approval and raw JSON previews collapsed. Existing human approval and fingerprint invalidation logic remain unchanged.
- lib/i18n.ts: localized zh-Hant and zh-en labels/copy.
- app/globals.css: legible reading typography, content hierarchy, mobile responsive components.
- tests/source-fetch-helper.test.mjs: Chinese narrative instruction and unchanged verbatim evidence requirement asserted.
No data schema, Access/Tunnel/API key, model/provider, schedules, or production daily changes.

## Validation
- Full tests 125/125 PASS; TypeScript PASS; data validators PASS; normal production and mobile builds PASS in isolated /tmp/radar-build-20261013.HV41.
- Playwright Chromium 390x844 synthetic E2E PASS: manual paste → simulated Chinese analysis → reading card → editable enrichment → save/reload → Review initially blocked by creator/grade and manual approval → correct creator & grade inline → mark reviewed → approve and download candidate → immediate reload retains approval. One mocked AI request, no model tokens spent, no page errors. Separate source-reuse action remains independent.
- Viewport QA 360, 390, 768, 1280 PASS; no horizontal scrolling. Screenshot evidence:
  evidence/2026-10-14-reading-first-draft-390.png
  evidence/2026-10-14-reading-first-review-390.png
  evidence/2026-10-14-reading-first-reviewed-390.png
- External reference: https://news.aibase.com/tw/daily and https://www.aibase.com/zh/daily for short summaries and scanning-first information hierarchy, not copied visual assets/code.

## Limitations and release gate
- Existing previously generated English drafts stay English. Changing prompt affects ONLY new explicit AI analysis requests (may consume API quota); no automatic translation of prior source content, never translate source evidence excerpts.
- Claim citation location != claim independently verified. User must verify evidence supports claims and manually choose grade; summaries remain drafts.
- Actual live article input/large-scale UX usability on Owner browser unknown; synthetic tests are not Owner UAT.
- **NOT DEPLOYED**. Running protected Radar and companion helper at radar.lamlab.cc remain on prior approved release. Owner must authorize deployment and complete real-article UAT. No commit, push, or app changes outside Radar.
