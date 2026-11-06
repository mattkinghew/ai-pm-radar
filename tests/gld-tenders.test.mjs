import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { collect, runDaily } from "../cloud/src/collector.mjs";
import { GLD_TENDER_DAILY_CAP, selectGldTenders } from "../cloud/src/gld-tenders.mjs";

function record({ no, en, zh, status = "I", link = `https://pcms2.gld.gov.hk/iportal/notice/${no}`, department = "數字政策辦公室", closing = "2026-12-01 12:00:00" }) {
  return `<TenderNoticeRecord>
    <TenderNo>${no}</TenderNo>
    <SubjectEnglish>${en}</SubjectEnglish>
    <SubjectChinese>${zh}</SubjectChinese>
    <ReqDepartmentNameChinese>${department}</ReqDepartmentNameChinese>
    <ClosingDateTime>${closing}</ClosingDateTime>
    <Status>${status}</Status>
    <Link>${link}</Link>
    <Email>enquiry@example.gov.hk</Email>
    <TelephoneNumber>12345678</TelephoneNumber>
  </TenderNoticeRecord>`;
}

function xml(records) {
  return `<?xml version="1.0"?><TenderNoticeList>${records}</TenderNoticeList>`;
}

test("keeps an issued digital tender and drops stationery", () => {
  const result = selectGldTenders(xml([
    record({ no: "A001", en: "Supply of waiting room chairs", zh: "候診椅供應" }),
    record({ no: "A002", en: "AI chatbot for public service", zh: "公共服務人工智能對話系統" }),
  ].join("")));
  assert.equal(result.ok, true);
  assert.equal(result.matched, 1);
  assert.equal(result.omitted, 0);
  assert.equal(result.items[0].externalId, "gld:A002");
  assert.equal(result.items[0].title, "公共服務人工智能對話系統");
  assert.equal(result.items[0].department, "數字政策辦公室");
  assert.equal(result.items[0].source, "gld-etb");
  assert.equal(result.items[0].excerpt.includes("enquiry@example.gov.hk"), false);
  assert.equal(result.items[0].excerpt.includes("12345678"), false);
});

test("drops cancelled and suspended tenders even when the subject matches", () => {
  const result = selectGldTenders(xml([
    record({ no: "B001", en: "Cloud hosting", zh: "雲端主機", status: "L" }),
    record({ no: "B002", en: "Cybersecurity monitoring", zh: "網絡安全監測", status: "S" }),
  ].join("")));
  assert.deepEqual(result.items, []);
  assert.equal(result.matched, 0);
});

test("dedups by tender number and skips refs already seen", () => {
  const result = selectGldTenders(xml([
    record({ no: "C001", en: "Software licence", zh: "軟件許可" }),
    record({ no: "C001", en: "Software licence duplicate", zh: "軟件許可重複" }),
    record({ no: "C002", en: "Information technology support", zh: "資訊科技支援" }),
  ].join("")), { seenRefs: ["gld:C002"] });
  assert.deepEqual(result.items.map((item) => item.tenderNo), ["C001"]);
});

test("caps a day at 10 and reports how many matches were left out", () => {
  const records = Array.from({ length: GLD_TENDER_DAILY_CAP + 1 }, (_, index) => record({
    no: `D${index}`,
    en: `Digital service ${index}`,
    zh: `數碼服務 ${index}`,
  })).join("");
  const result = selectGldTenders(xml(records));
  assert.equal(result.items.length, GLD_TENDER_DAILY_CAP);
  assert.equal(result.matched, GLD_TENDER_DAILY_CAP + 1);
  assert.equal(result.omitted, 1);
  assert.equal(result.items[0].tenderNo, "D0");
});

test("rejects a non-http link and does not treat ordinary English as AI", () => {
  const result = selectGldTenders(xml([
    record({ no: "E001", en: "Detail of the waiting list", zh: "輪候詳情", link: "javascript:alert(1)" }),
    record({ no: "E002", en: "Email notice for the canteen", zh: "食堂電郵通知" }),
  ].join("")));
  assert.deepEqual(result.items, []);
});

test("returns unreadable for a non-string and no items for an incomplete record", () => {
  const broken = selectGldTenders(null);
  assert.equal(broken.ok, false);
  assert.equal(broken.reason, "unreadable");
  assert.deepEqual(broken.items, []);
  const incomplete = selectGldTenders("<TenderNoticeList><TenderNoticeRecord>");
  assert.equal(incomplete.ok, true);
  assert.deepEqual(incomplete.items, []);
});

test("daily collection does not fetch or select GLD tenders", () => {
  const collector = readFileSync(new URL("../cloud/src/collector.mjs", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../cloud/src/worker.mjs", import.meta.url), "utf8");
  assert.equal(collector.includes("selectGldTenders"), false);
  assert.equal(collector.includes("TenderNotice.xml"), false);
  assert.equal(worker.includes("selectGldTenders"), false);
  assert.equal(collect.toString().includes("gld"), false);
  assert.equal(runDaily.toString().includes("gld"), false);
});
