import test from "node:test";
import assert from "node:assert/strict";
import { cleanThreadsExport } from "../cloud/public/threads-import.mjs";
import { parseNotes } from "../cloud/src/reader.mjs";

const post = (id, text, url = `https://www.threads.net/@maker/post/${id}`) => ({ id, url, text, author: { handle: "maker" } });

test("Threads cleaner deduplicates by ID or canonical URL and quarantines noise", () => {
  const result = cleanThreadsExport(JSON.stringify({ threads: [
    post("a", "A useful product workflow with enough context for a meaningful note."),
    post("a", "Duplicate ID with different text and a sufficiently long body.", "https://threads.net/post/other"),
    post("b", "A useful product workflow with enough context for a meaningful note.", "https://www.threads.net/@maker/post/a/?utm_source=export"),
    post("c", "急聘：我們正在尋找有經驗的產品工程師加入團隊。"),
    post("d", "太短")
  ] }));
  assert.equal(result.rawCount, 5);
  assert.equal(result.uniqueCount, 3);
  assert.equal(result.validItems.length, 1);
  assert.equal(result.quarantinedItems.length, 2);
  assert.match(result.quarantinedItems[0].quarantine_reason, /^noise_keyword:/u);
  assert.equal(result.quarantinedItems[1].quarantine_reason, "insufficient_context");
  assert.equal(result.validItems[0].lane, "APPLY_NOW");
});

test("formatted notes sanitize internal separators and round-trip through parseNotes", () => {
  const result = cleanThreadsExport([post("one", "OpenAI released a practical approach with enough details for product teams.\n---\nThe second paragraph remains in this note. https://github.com/Example/Project.git")]);
  const notes = parseNotes(result.batches[0].text);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].url, "https://www.threads.net/@maker/post/one");
  assert.ok(notes[0].tags.includes("threads_saved"));
  assert.ok(notes[0].tags.includes("GITHUB_PROJECT"));
  assert.match(notes[0].note, /———/u);
  assert.match(notes[0].note, /#threads_saved #GITHUB_PROJECT #maker/u);
  assert.deepEqual(result.githubRepos, ["https://github.com/example/project"]);
});

test("formatted batches never exceed 50 notes", () => {
  const result = cleanThreadsExport({ data: Array.from({ length: 105 }, (_, i) => post(String(i), `A product team published a useful workflow example with enough detail for record ${i}.`)) });
  assert.deepEqual(result.batches.map((batch) => batch.items.length), [50, 50, 5]);
  assert.deepEqual(result.batches.map((batch) => parseNotes(batch.text).length), [50, 50, 5]);
});

test("GitHub repository URLs are normalized and unique", () => {
  const result = cleanThreadsExport([post("a", "A useful project note https://github.com/Org/Repo.git?tab=readme and https://github.com/org/repo/.")]);
  assert.deepEqual(result.githubRepos, ["https://github.com/org/repo"]);
});

test("malformed, empty and unsupported JSON return clear validation errors", () => {
  assert.throws(() => cleanThreadsExport("{"), /JSON 格式無效/u);
  assert.throws(() => cleanThreadsExport(""), /JSON 格式無效/u);
  assert.throws(() => cleanThreadsExport("[]"), /沒有可處理的貼文/u);
  assert.throws(() => cleanThreadsExport({ hello: "world" }), /沒有可處理的貼文/u);
});
