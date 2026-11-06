import { XMLParser } from "fast-xml-parser";

/** Official open-data file. Not fetched by the daily cron until a separate Owner GO. */
export const GLD_TENDER_XML_URL = "https://pcms2.gld.gov.hk/iportal/TenderNotice.xml";
export const GLD_TENDER_DAILY_CAP = 10;
export const GLD_TENDER_SOURCE = "gld-etb";
export const GLD_TENDER_CATEGORY = "HK_TENDER";

/**
 * Subject keywords for digital / AI tenders.
 * Short English tokens are matched as whole words so "detail" and "email" stay out.
 * Telephone, fax, and enquiry email from the file are never copied into the draft.
 */
const SUBJECT_KEYWORD = /(?:^|[^A-Za-z0-9])AI(?:[^A-Za-z0-9]|$)|人工智能|人工智慧|artificial intelligence|數碼|數字轉型|數位|資訊科技|information technology|(?:^|[^A-Za-z0-9])IT(?:[^A-Za-z0-9]|$)|軟件|软件|\bsoftware\b|雲端|雲計算|云计算|\bcloud\b|網絡安全|网络安全|cybersecurity|資訊系統|信息系统|數據中心|数据中心|data cent(?:re|er)/i;

const text = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();

function asList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function httpUrl(value) {
  const url = text(value);
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

function subjectMatches(english, chinese) {
  return SUBJECT_KEYWORD.test(`${english}\n${chinese}`);
}

/**
 * Select issued digital/AI tenders from a GLD e-Tender Box XML string.
 * Does not fetch the network. Cancelled and suspended rows are left out.
 * More than the daily cap returns the first rows and an omitted count.
 */
export function selectGldTenders(xml, { limit = GLD_TENDER_DAILY_CAP, seenRefs = [] } = {}) {
  const seen = new Set(seenRefs.map((ref) => text(ref).replace(/^gld:/u, "")));
  if (typeof xml !== "string") return { ok: false, reason: "unreadable", items: [], matched: 0, omitted: 0 };
  let doc;
  try {
    doc = new XMLParser({ ignoreAttributes: false }).parse(xml);
  } catch {
    return { ok: false, reason: "unreadable", items: [], matched: 0, omitted: 0 };
  }
  if (!doc || typeof doc !== "object") return { ok: false, reason: "unreadable", items: [], matched: 0, omitted: 0 };
  const records = asList(doc?.TenderNoticeList?.TenderNoticeRecord);
  const matched = [];
  for (const record of records) {
    const tenderNo = text(record?.TenderNo);
    const english = text(record?.SubjectEnglish);
    const chinese = text(record?.SubjectChinese);
    const url = httpUrl(record?.Link);
    if (!tenderNo || !url || text(record?.Status) !== "I") continue;
    if (!subjectMatches(english, chinese) || seen.has(tenderNo)) continue;
    seen.add(tenderNo);
    const department = text(record?.ReqDepartmentNameChinese) || text(record?.ReqDepartmentNameEnglish)
      || text(record?.IssuingDepartmentNameChinese) || text(record?.IssuingDepartmentNameEnglish);
    const closingAt = text(record?.ClosingDateTime);
    matched.push({
      title: chinese || english,
      url,
      excerpt: [chinese, english, department && `部門：${department}`, closingAt && `截止：${closingAt}`].filter(Boolean).join("\n").slice(0, 3000),
      source: GLD_TENDER_SOURCE,
      category: GLD_TENDER_CATEGORY,
      externalId: `gld:${tenderNo}`,
      tenderNo,
      department,
      closingAt,
    });
  }
  return {
    ok: true,
    items: matched.slice(0, limit),
    matched: matched.length,
    omitted: Math.max(0, matched.length - limit),
  };
}
