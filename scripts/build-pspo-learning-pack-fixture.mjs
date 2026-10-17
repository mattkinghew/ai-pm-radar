import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { approveHandoff, createHandoffDraft, markHandoffReviewed, updateHandoff } from "../lib/downstream-handoff.ts";
import { createDeliveryPackage, validateDeliveryPackage } from "../lib/delivery-package.ts";
import { createSourceLibraryEntry } from "../lib/source-library.ts";
import { normaliseSourceInput } from "../lib/source-inbox.ts";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const outputDirectory = join(root, "fixtures/pspo-i-learning-pack");
const sourceUrl = "https://scrumguides.org/scrum-guide.html";
const capturedAt = "2026-10-11T06:00:00.000Z";
const excerpts = [
  "maximizing the value of the product",
  "Developing and explicitly communicating the Product Goal",
  "Ordering Product Backlog items",
  "future state of the product",
];
const sourceText = excerpts.join("\n");
const evidence = excerpts.map((text_reference) => ({ source: sourceUrl, timestamp: null, text_reference }));
const record = {
  ...normaliseSourceInput({
    value: sourceText,
    kind: "paste_text",
    sourceUrl,
    title: "The Scrum Guide (November 2020) — selected Product Owner and Product Goal passages",
    creator: "Ken Schwaber and Jeff Sutherland",
    capturedAt,
    language: "en",
  }, { now: capturedAt }).record,
  summary: "Selected official Scrum Guide passages about Product Owner accountability, Product Backlog management, and Product Goal.",
  key_points: [
    "The Product Owner is accountable for maximizing product value.",
    "Product Backlog management includes communicating the Product Goal and ordering Product Backlog items.",
    "The Product Goal describes a future product state for planning.",
  ],
  key_claims: [
    { claim: "The Product Owner is accountable for maximizing product value.", evidence: [evidence[0]] },
    { claim: "Product Backlog management includes communicating the Product Goal and ordering items.", evidence: [evidence[1], evidence[2]] },
    { claim: "The Product Goal describes a future product state.", evidence: [evidence[3]] },
  ],
  evidence,
  rights_note: "Official November 2020 Scrum Guide; scrumguides.org states CC BY-SA 4.0. Preserve attribution and ShareAlike for adaptations.",
  analysis: {
    version: 1,
    status: "not_requested",
    provider: "none",
    model: null,
    analyzed_at: null,
    input_chars: 0,
    usage: null,
    error_code: null,
    source_facts: [
      "The Product Owner is accountable for maximizing product value.",
      "Product Backlog management includes communicating the Product Goal and ordering items.",
      "The Product Goal describes a future product state.",
    ],
    inferences: [
      "Study prompts and the illustrative scenario are manual instructional synthesis, not Scrum Guide quotations.",
    ],
    use_cases: [],
    method_or_teaching_points: [],
  },
  review_status: "reviewed",
  approval_status: "approved",
};
const approvedAt = "2026-10-11T06:02:00.000Z";
const entry = createSourceLibraryEntry(record, approvedAt);
const draft = createHandoffDraft(entry, "learning_pack", "2026-10-11T06:03:00.000Z");
const handoff = updateHandoff(draft, {
  derived_analysis: {
    learning_objectives: [
      "用自己的語言說明 Product Owner 對最大化產品價值及 Product Backlog management 的 accountability。",
      "解釋 Product Goal 如何描述未來狀態，並作為 Product Backlog 演進與規劃的目標。",
      "以來源 evidence 區分 Scrum Guide 明確陳述與個人情境推論。",
    ],
    concepts: [
      "Product Owner accountability：可委派工作，但 accountability 仍由 Product Owner 承擔。",
      "Product Backlog management：包括 Product Goal、清楚溝通 backlog items、排序，以及保持透明、可見、可理解。",
      "Product Goal：Product Backlog 的 commitment；描述產品未來狀態，供 Scrum Team 規劃。",
    ],
    definitions: [
      "Product Goal（意譯）：Scrum Team 的長期目標，描述產品未來狀態，供團隊規劃；完成或放棄一個目標後才轉向下一個。",
      "Product Backlog（意譯）：為改善產品所需工作的持續演進、有序清單，也是 Scrum Team 所承擔工作的單一來源。",
    ],
    examples: [
      "Illustrative scenario (not a Guide fact): a team reorders two backlog items after learning that one better supports its current Product Goal; explain the trade-off and make the ordering rationale visible.",
    ],
    misconceptions: [
      "誤解：Product Owner 必須親自完成所有 backlog 管理工作。修正：部分工作可委派，但 accountability 不轉移。",
      "誤解：Product Goal 是 Sprint Goal 的別名。修正：兩者時間範圍與所屬 artifact commitment 不同。",
      "誤解：Product Owner 是由多位 stakeholder 組成的 committee。修正：Scrum Guide 將其定義為一個人，可代表多方需要。",
    ],
    question_seeds: [
      "你會用哪些可觀察 evidence 判斷一個 backlog 順序是否支援現行 Product Goal？",
      "哪些 Product Backlog 工作可委派，哪些 accountability 仍不能委派？",
      "若新資訊令原 Product Goal 不再有價值，團隊應如何檢視與調整？請指出需要核對的 Scrum Guide 段落。",
    ],
    difficulty_suggestion: "Foundational to intermediate; focus on applying accountabilities and artifact commitments, not memorizing exam answers.",
    review_focus: [
      "逐項核對 source_facts 與 Scrum Guide 原文；definitions 是中文意譯，不是逐字引文。",
      "確認 illustrative scenario 被標示為教學推演，不是 Guide 案例。",
      "對照 Scrum.org 最新公開 PSPO I learning objectives 前，勿把本包視為完整 assessment blueprint。",
    ],
    unknowns: [
      "本包只涵蓋 Scrum Guide 中與 Product Owner／Product Goal 相關的選段，並非完整 PSPO I 課程或考試範圍。",
      "沒有使用、重製或推測任何受保護考題；question seeds 是自編開放式學習提示。",
      "Scrum Guide 為 November 2020 版本；若官方發布新版，需重新核對內容與引用。",
    ],
  },
  human_notes: "Manually curated learning handoff; instructional synthesis is not a Scrum Guide quotation or official Scrum.org course. Source: Ken Schwaber and Jeff Sutherland, The Scrum Guide (November 2020), https://scrumguides.org/scrum-guide.html. The official page states CC BY-SA 4.0; attribution and ShareAlike apply to adaptations. No exam dumps or protected question-bank items included.",
}, "2026-10-11T06:04:00.000Z");
const reviewed = markHandoffReviewed(handoff, "2026-10-11T06:05:00.000Z");
const approved = approveHandoff(reviewed, entry, "2026-10-11T06:06:00.000Z");
const deliveryPackage = createDeliveryPackage(entry, approved, "2026-10-11T06:07:00.000Z");
if (!validateDeliveryPackage(deliveryPackage)) throw new Error("PSPO I learning-pack package failed validation.");

await mkdir(outputDirectory, { recursive: true });
const artifacts = {
  "source-record.json": record,
  "handoff.json": approved,
  "delivery-package.json": deliveryPackage,
};
for (const [name, value] of Object.entries(artifacts)) {
  await writeFile(join(outputDirectory, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

process.stdout.write(`${JSON.stringify({
  fixture_directory: "fixtures/pspo-i-learning-pack",
  source_record_id: record.id,
  handoff_id: approved.id,
  package_id: deliveryPackage.package_id,
  target_product: deliveryPackage.target_product,
  status: approved.status,
  source_evidence_count: record.evidence.length,
  package_evidence_count: deliveryPackage.evidence_references.length,
  source_url: sourceUrl,
  rights_note: record.rights_note,
  artifacts: Object.keys(artifacts),
}, null, 2)}\n`);
