import assert from "node:assert/strict";
import test from "node:test";
import { assertApprovalIntegrity, createApprovalSeal, toCanonicalBytes } from "../lib/approval-integrity.ts";

test("canonical bytes sort object keys and preserve UTF-8 content bytes", () => {
  assert.equal(new TextDecoder().decode(toCanonicalBytes({ z: 1, a: "é" })), '{"a":"é","z":1}');
});

test("negative: a one-byte content or evidence-offset mutation rejects the old seal", async () => {
  const approved = { content: "approved text", evidence: [{ text: "quote", offset: 0 }] };
  const seal = await createApprovalSeal(approved);
  await assertApprovalIntegrity(approved, seal);
  await assert.rejects(assertApprovalIntegrity({ ...approved, content: "approved texu" }, seal), /integrity check failed/i);
  await assert.rejects(assertApprovalIntegrity({ ...approved, evidence: [{ text: "quote", offset: 1 }] }, seal), /integrity check failed/i);
});
